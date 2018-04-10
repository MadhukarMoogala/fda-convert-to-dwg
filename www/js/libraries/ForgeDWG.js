/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

if (!window.jQuery) alert('jQuery is required for this sample');

var ToSpin = {
  start : true,
  stop : false
}
var spinner;
var ForgeDWG = {
  Utility: {
    Constants: {
      BASE_URL: 'https://developer.api.autodesk.com',
      DESIGN_AUTOMATION_V2: '/autocad.io/us-east/v2/',
      WORK_ITEMS_V2: 'WorkItems'
    }

  },
  exportDWG: function (projectId, itemId, fileName, token, status, fileType) {

    if (fileType.indexOf('CATPart') == -1) {
      if (status) status(true, 'Not a CATPart file. Only CATIA files are supported, at the moment. Aborting conversion.');
      return;
    }

    if (status) {
      status(false, 'Preparing ' + fileName);
    }
    $.ajax({
      url: '/da/submitWorkItem',
      type: 'POST',
      data: { "projectId": projectId, "itemId": itemId, "session": token, "fileName": fileName }
    }).done(function (data) {
      var res = data;
      if (res.success) {
        spin(ToSpin.start);
        $.ajax({
          url: '/da/getWorkItemStatus',
          type: 'GET',
          data: { "workItemId": res.workItemId,"session": token }

        }).done(function (res) {
          if (res.success) {
            spin(ToSpin.stop);
            displayReport(res.reportPDF);
          }

        });

      }
    });

    if (status) {
      status(true, 'Exporting...');
    }
  }

};
function displayReport(report) {
  var msg = "";  
  if (report) {
      msg += "<a href=";
      msg += report;
      msg += ">";
      msg += "Download Drawing";
      msg += "</a>";
  }
  document.getElementById("forgeFileOptions").innerHTML = "<br/>" + msg;
}

function spin(torf)
{
 
  if(torf === ToSpin.stop && spinner != undefined)
  {
   spinner.stop();
    
  }
  else //define spinner
  {
  var opts = {
    lines: 12, // The number of lines to draw
    length: 5, // The length of each line
    width: 5, // The line thickness
    radius: 7, // The radius of the inner circle
    color: '#000', // #rbg or #rrggbb
    speed: 1, // Rounds per second
    trail: 100, // Afterglow percentage
    shadow: true // Whether to render a shadow
  };
  var target = document.getElementById('forgeFileOptions');
  spinner = new Spinner(opts).spin(target);
}
}

