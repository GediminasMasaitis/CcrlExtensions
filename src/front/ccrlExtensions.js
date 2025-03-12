// ==UserScript==
// @name        CCRL Extensions
// @namespace   Violentmonkey Scripts
// @match       https://ccrl.live/*
// @grant       GM.xmlHttpRequest
// @version     1.0
// @author      Gediminas Masaitis
// @description Kibitzer and eval graph support for CCRL
// @require     https://code.jquery.com/jquery-3.7.0.min.js
// @require     https://cdn.jsdelivr.net/npm/chart.js
// ==/UserScript==

(function() {
  'use strict';

    var container = $('.container');
    container.css('max-width', '180vh');

    var layout = $('.main-layout');
    layout.css('grid-template-columns', '40% 30% 30%');

    for(var kibitzerIndex = 0; kibitzerIndex < 2; kibitzerIndex++)
    {
      var kibitzerNum = kibitzerIndex + 1;
      layout.append(`<div id="kibitzer${kibitzerNum}-info"></div>`);
      var kibitzerInfo = $(`#kibitzer${kibitzerNum}-info`);
      var row = kibitzerIndex % 2 == 0 ? '1' : '4';
      kibitzerInfo.css('grid-row-start', row);
      kibitzerInfo.css('grid-column-start', '3');

      kibitzerInfo.append(`<h3 id="kibitzer${kibitzerNum}-name">Kibitzer ${kibitzerNum} inactive</h3>`);
      kibitzerInfo.append(`
    <div class="card fluid">
      <div class="row">
        <div class="col-sm">
          <div class="row">
            <div class="col-sm info">
              <p class="small-margin"><small class="info-header">Score</small></p>
              <p class="small-margin info-value" id="kibitzer${kibitzerNum}-score">0</p>
            </div>
            <div class="col-sm info">
              <p class="small-margin"><small class="info-header">Depth</small></p>
              <p class="small-margin info-value" id="kibitzer${kibitzerNum}-depth">0</p>
            </div>
            <div class="col-sm info">
              <p class="small-margin"><small class="info-header">Nodes</small></p>
              <p class="small-margin info-value" id="kibitzer${kibitzerNum}-nodes">0</p>
            </div>
            <div class="col-sm info">
              <p class="small-margin"><small class="info-header">Nps</small></p>
              <p class="small-margin info-value" id="kibitzer${kibitzerNum}-nps">0</p>
            </div>
          </div>
        </div>
        <div class="col-sm-3" style="text-align: right">
          <h3><small id="kibitzer${kibitzerNum}-time"><mark>	&#8734; </mark></small></h3>
        </div>
        <div class="col-sm-12">
          <p class="pv"><small id="kibitzer${kibitzerNum}-pv"></small></p>
        </div>
      </div>
    </div>`);
    }


    layout.append('<div id="eval-chart-container"><canvas id="eval-chart"></canvas></div>')
    var evalChartContainer = $("#eval-chart-container");
    evalChartContainer.css('grid-row-start', '2');
    evalChartContainer.css('grid-row-end', '4');
    evalChartContainer.css('grid-column-start', '3');

    layout.append('<div id="kibitzer2-info"></div>');
    var kibitzerInfo = $('#kibitzer2-info');
    kibitzerInfo.css('grid-row-start', '4');
    kibitzerInfo.css('grid-column-start', '3');

  const ctx = $("#eval-chart").get(0);
  var chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'White',
        data: [],
        borderColor: 'rgb(220, 220, 220)'
      },
      {
        label: 'Black',
        data: [],
        borderColor: 'rgb(100, 100, 100)'
      },
      {
        label: 'Kibitzer 1',
        data: [],
        borderColor: 'rgb(220, 100, 100)'
      },
      {
        label: 'Kibitzer 2',
        data: [],
        borderColor: 'rgb(100, 100, 220)'
      },
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  var currentFen = "";
  var labels = [];
  var scores = [{},{},{},{}];

  function getFen(){
    return $("#fen").text();
  }

  function sendFen() {
    var fen = getFen();

    if(fen == "") {
      return;
    }

    if(fen == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
      labels = [];
      scores = [{},{},{},{}];
    }

    if(fen == currentFen){
      return;
    }

    currentFen = fen;

    var request = {
      fen: fen
    };
    var requestJson = JSON.stringify(request);

    GM.xmlHttpRequest({
      method: "POST",
      url: "http://127.0.0.1:5210/fen",
      headers: {
        "Content-Type": "application/json"
      },
      data: requestJson,
      onload: function(response){
        var responseObj = JSON.parse(response.responseText);
        if(responseObj.engines.length > 0){
          $("#kibitzer1-name").text(responseObj.engines[0].name)
        }
        if(responseObj.engines.length > 1){
          $("#kibitzer2-name").text(responseObj.engines[1].name)
        }
      }
    });
  }

  $('#fen').on('DOMSubtreeModified', function(){
    sendFen();
  });

  function formatCompactNumber(number) {
    if (number < 1000) {
      return number;
    } else if (number >= 1000 && number < 1_000_000) {
      return (number / 1000).toFixed(2) + "k";
    } else if (number >= 1_000_000 && number < 1_000_000_000) {
      return (number / 1_000_000).toFixed(2) + "M";
    } else if (number >= 1_000_000_000 && number < 1_000_000_000_000) {
      return (number / 1_000_000_000).toFixed(2) + "B";
    } else if (number >= 1_000_000_000_000 && number < 1_000_000_000_000_000) {
      return (number / 1_000_000_000_000).toFixed(2) + "T";
    }
  }

  function updateChart(){

  }

  setInterval(function() {
    var fen = getFen();
    if(fen == ""){
      return;
    }

    var fenWords = fen.split(" ");
    var lastFenWord = fenWords[fenWords.length - 1];
    var ply = parseInt(lastFenWord) * 2;
    if(fen.includes(" b ")){
      ply += 1;
    }
    var plyStr = ply.toString();
    if(!labels.includes(plyStr)){
      labels.push(plyStr);
      chart.data.labels = labels;
    }

    GM.xmlHttpRequest({
      method: "GET",
      url: "http://127.0.0.1:5210/query",
      onload: function(response){
        var responseObj = JSON.parse(response.responseText);
        for(var engineIndex = 0; engineIndex < responseObj.engineInfos.length; engineIndex++) {
          var kibitzerNum = engineIndex+1;
          var info = responseObj.engineInfos[engineIndex];
          var score = info.score / 100;
          $("#kibitzer" + kibitzerNum + "-score").text(score);
          $("#kibitzer" + kibitzerNum + "-depth").text(info.depth);
          $("#kibitzer" + kibitzerNum + "-nodes").text(formatCompactNumber(info.nodes));
          $("#kibitzer" + kibitzerNum + "-nps").text(formatCompactNumber(info.nps));
          $("#kibitzer" + kibitzerNum + "-pv").text(info.pv);

          var scoreIndex = engineIndex + 2;
          scores[scoreIndex][plyStr] = score;
          chart.data.datasets[scoreIndex].label = info.name;
        }
      },
      onerror: function(){
        console.log("Failed querying backend");
      }
    });

    var whiteScore = parseFloat($("#white-score").text());
    scores[0][plyStr] = whiteScore
    var blackScore = parseFloat($("#black-score").text());
    scores[1][plyStr] = blackScore

    var chartData = [];
    for (var i = 0; i < scores.length; i++){
       chartData.push([]);
       // iterate over the labels array to ensure alignment with the x-axis
       for (var j = 0; j < labels.length; j++){
          var plyKey = labels[j];
          // If the score exists for that ply, use it; otherwise, use null (or 0)
          chartData[i].push(scores[i][plyKey] !== undefined ? scores[i][plyKey] : null);
       }
       chart.data.datasets[i].data = chartData[i];
    }
    chart.update();
  }, 1000);

})();
