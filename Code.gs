// for API https://script.google.com/macros/s/AKfycbwetE7pJEr-3RJp-nZv1G7s8cqI8BjVtBK0fuyKA7MzldqKCZyo/exec?code={bike code}&callback={callback}
function doGet(e) {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));

  // ports info from spreadsheet
  const ports = sheet.getSheetByName("ports");
  const ports_values = ports.getDataRange().getValues();
  const ports_headers = ports_values.shift();

  // bikes info from spreadsheet
  const bikes = sheet.getSheetByName("bikes");
  const bikes_values = bikes.getDataRange().getValues();
  const bikes_headers = bikes_values.shift();

  // bikes info from spreadsheet
  const history = sheet.getSheetByName("history");
  const history_values = history.getDataRange().getValues();
  const history_headers = history_values.shift();

  //utility functions
  const getPorts = (row) => {
    let port = {};
    row.map((column, index) => {
      port[ports_headers[index]] = column;
    });
    return port;
  };
  const getBikes = (row) => {
    let bike = {};
    row.map((column, index) => {
      bike[bikes_headers[index]] = column;
    });
    return bike;
  };

  let result = {
    status: "error"
  };
  if (e.parameter.id) { // get data for specific port ex) "?id=3023"
    // get id from URL parameter
    const id = e.parameter.id;
    result.port = ports_values.filter((v) => {
      return v[0] == id;
    }).map(getPorts).shift();

    //skip if port can't find
    if (result.port) {
      result.bikes = bikes_values.filter((value) => {
        return value[11] == id;
      }).map(getBikes);

      const bikes_ids = result.bikes.map((value) => value.code);

      result.related_bikes = history_values.filter((value) => {
        return value[1] == id || value[2] == id;
      }).map((value) => {
        return value[0];
      }).filter(function(elem, index, self) {
        return self.indexOf(elem) === index;
      }).filter((value) => {
        return !bikes_ids.includes(value)
      }).map((value) => {
        return bikes_values.filter((v) => {
          return v[0] === value;
        }).map(getBikes).shift();
      }).filter((value) => value);
      result.status = "success";
    }
  } else if (e.parameter.code) { // get data for specific bike ex) "?code=A0695"
    // get code from URL parameter
    const code = e.parameter.code;
    // find out taret bike of "code"
    const bike = bikes_values.filter((value) => {
      return value[0] === code;
    }).map(getBikes).shift();

    //skip if bike can't find
    if (bike) {
      // collect "code"'s history
      const port_history = history_values.filter((value) => {
        return value[0] === code;
      }).map((value) => {
        return [value[1], value[2]];
      }).flat().concat([bike.latest_port_id]).filter((value, index, self) => {
        return self[index - 1] !== value;
      }).map((value) => {
        return ports_values.filter((v) => {
          return v[0] === value;
        }).map(getPorts).shift();
      }).filter((value) => value);

      // create result
      result.bike = bike;
      result.history = port_history;
      result.history_map = "https://www.google.com/maps/dir/" + port_history.map((value) => {
        return value.lat + "," + value.lng;
      }).flat().join("/");
      result.status = "success";
    }
  } else { // get whole data of ports
    result.ports = ports_values.map(getPorts);
    result.status = "success";
  }
  // generate output
  const output = ContentService.createTextOutput();

  if (e.parameter.callback === undefined) {
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(result));
  } else {
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    output.setContent(e.parameter.callback + "&&" + e.parameter.callback + "(" + JSON.stringify(result) + ");");
  }
  return output;
}

// For interval crawler
function myFunction() {
  const data = JSON.parse(UrlFetchApp.fetch("https://www.hellocycling.jp/app/top/port_json")
    .getContentText());
  // ports info from spreadsheet
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  const ports = sheet.getSheetByName("ports");
  const ports_last = ports.getLastRow();
  const ports_values = ports.getDataRange().getValues();
  const ports_headers = ports_values.shift();
  const ports_new = [];
  // bikes info from spreadsheet
  const bikes = sheet.getSheetByName("bikes");
  const bikes_last = bikes.getLastRow();
  const bikes_values = bikes.getDataRange().getValues();
  const bikes_headers = bikes_values.shift();
  bikes_headers.pop();
  const bikes_new = [];
  // history info from spreadsheet
  const history = sheet.getSheetByName("history");
  const history_last = history.getLastRow();
  const history_values = history.getDataRange().getValues();
  const history_headers = history_values.shift();

  // analyze data from json
  for (let [ports_key, ports_value] of Object.entries(data)) {
    let ports_row = [];
    ports_headers.forEach((header) => {
      ports_row.push(ports_value[header]);
    });
    ports_new.push(ports_row);
    for (let [bikes_key, bikes_value] of Object.entries(ports_value.bike_list)) {
      let bikes_row = [];
      bikes_headers.forEach((header) => {
        bikes_row.push(bikes_value[header]);
      });
      const diff = bikes_values.filter((value) => {
        return value[0] == bikes_value.code && value[11] != ports_value.id
      });
      if (diff.length === 1) {
        history_values.push([diff[0][0], diff[0][11], ports_value.id, new Date()]);
      }
      bikes_row.push(ports_value.id);
      bikes_new.push(bikes_row);
    }
  }
  // write "ports"
  ports.getRange(2, 1, ports_last, ports_headers.length).clearContent();
  ports.getRange(2, 1, ports_new.length, ports_headers.length).setValues(ports_new);
  // write "bikes"
  bikes.getRange(2, 1, bikes_last, bikes_headers.length + 1).clearContent();
  bikes.getRange(2, 1, bikes_new.length, bikes_headers.length + 1).setValues(bikes_new);
  // write "history"
  history.getRange(2, 1, history_last, history_headers.length).clearContent();
  history.getRange(2, 1, history_values.length, history_headers.length).setValues(history_values);
}
