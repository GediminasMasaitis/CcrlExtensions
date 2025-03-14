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
// @require     https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js
// ==/UserScript==

(function () {
  'use strict';

  // Utility functions
  const formatCompactNumber = (number) => {
    if (number < 1000) return number;
    const units = ['k', 'M', 'B', 'T'];
    let unitIndex = -1;
    while (number >= 1000 && unitIndex < units.length - 1) {
      number /= 1000;
      unitIndex++;
    }
    return `${number.toFixed(2)}${units[unitIndex]}`;
  };

  const getFullmoveNumberFromFen = (fen) => {
    const parts = fen.split(" ");
    return parts.length === 6 ? parseInt(parts[5]) : 1;
  };

  const convertPVToAlgebraic = (pv, startingFen) => {
    if (typeof Chess === 'undefined') {
      console.error("Chess.js not loaded");
      return pv;
    }
    const chess = new Chess(startingFen);
    const moves = pv.trim().split(/\s+/);
    let groups = [];
    let currentMoveNumber = getFullmoveNumberFromFen(startingFen);

    moves.forEach((move, i) => {
      let moveObj = chess.move(move, {
        sloppy: true
      });
      if (!moveObj) return;

      if (chess.turn() === 'w') {
        groups.push({
          moveNumber: currentMoveNumber,
          white: moveObj.san,
          black: null
        });
      } else {
        if (groups.length > 0) {
          groups[groups.length - 1].black = moveObj.san;
        } else {
          groups.push({
            moveNumber: currentMoveNumber,
            white: null,
            black: moveObj.san
          });
        }
        currentMoveNumber++;
      }
    });

    return groups.map(group => {
      let moveNumberHtml = `<span style="color: #f5c276; font-weight: bold;">${group.moveNumber}.</span>`;
      let output = `${moveNumberHtml} <span style="color: #ffffff;">${group.white || '...'}</span>`;
      if (group.black) output += ` <span style="color: #ffffff;">${group.black}</span>`;
      return output;
    }).join(" ");
  };

  // DOM Manipulation and layout setup
  const container = $('.container').css('max-width', '180vh');
  const layout = $('.main-layout').css({
    "grid-template-columns": "40% 30% 30%"
  });

  for (let kibitzerIndex = 0; kibitzerIndex < 2; kibitzerIndex++) {
    const kibitzerNum = kibitzerIndex + 1;
    const kibitzerInfo = $(`<div id="kibitzer${kibitzerNum}-info"></div>`);
    layout.append(kibitzerInfo);
    kibitzerInfo.css({
      'grid-row-start': kibitzerIndex % 2 === 0 ? '1' : '4',
      'grid-column-start': '3'
    })
      .append(`<h3 id="kibitzer${kibitzerNum}-name">Kibitzer ${kibitzerNum} inactive</h3>`)
      .append(`
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
              <h3><small id="kibitzer${kibitzerNum}-time"><mark>&#8734;</mark></small></h3>
            </div>
            <div class="col-sm-12">
              <p class="pv"><small id="kibitzer${kibitzerNum}-pv"></small></p>
            </div>
          </div>
        </div>
      `)
      .append(`<p class="pv"><small id="kibitzer${kibitzerNum}-pv"></small></p>`)
      .append(`<p class="mainline" id="kibitzer${kibitzerNum}-mainline" style="margin-top: 5px; font-style: italic;"></p>`);
  }

  // Setup chart container
  const evalChartContainer = $('<div id="eval-chart-container"><canvas id="eval-chart"></canvas></div>');
  layout.append(evalChartContainer);
  evalChartContainer.css({
    'grid-row-start': '2',
    'grid-row-end': '4',
    'grid-column-start': '3',
    'position': 'relative',
    'z-index': '10'
  });

  const ctx = $("#eval-chart")[0];
  const chart = new Chart(ctx, {
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
      }
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

  // State
  let currentFen = "";
  let labels = [];
  let scores = [{}, {}, {}, {}];

  // Update FEN and send data
  const getFen = () => $("#fen").text();
  const sendFen = () => {
    const fen = getFen();
    if (!fen || fen === currentFen) return;
    currentFen = fen;
    if (fen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
      labels = [];
      scores = [{}, {}, {}, {}];
    }
    GM.xmlHttpRequest({
      method: "POST",
      url: "http://127.0.0.1:5210/fen",
      headers: {
        "Content-Type": "application/json"
      },
      data: JSON.stringify({
        fen
      }),
      onload: (response) => {
        const engines = JSON.parse(response.responseText).engines;
        if (engines.length > 0) $("#kibitzer1-name").text(engines[0].name);
        if (engines.length > 1) $("#kibitzer2-name").text(engines[1].name);
      }
    });
  };
  $('#fen').on('DOMSubtreeModified', sendFen);

  // Update the graph and kibitzers every second
  setInterval(() => {
    const fen = getFen();
    if (!fen) return;

    const ply = (parseInt(fen.split(" ")[5]) * 2) + (fen.includes(" b ") ? 1 : 0);
    const plyStr = ply.toString();
    if (!labels.includes(plyStr)) {
      labels.push(plyStr);
      chart.data.labels = labels;
    }

    GM.xmlHttpRequest({
      method: "GET",
      url: "http://127.0.0.1:5210/query",
      onload: (response) => {
        const engineInfos = JSON.parse(response.responseText).engineInfos;
        engineInfos.forEach((info, index) => {
          const kibitzerNum = index + 1;
          const score = info.score / 100;
          $(`#kibitzer${kibitzerNum}-score`).text(score);
          $(`#kibitzer${kibitzerNum}-depth`).text(info.depth);
          $(`#kibitzer${kibitzerNum}-nodes`).text(formatCompactNumber(info.nodes));
          $(`#kibitzer${kibitzerNum}-nps`).text(formatCompactNumber(info.nps));

          let multipvHtml = "";
          if (info.multipv) {
            info.multipv.sort((a, b) => a.multipv - b.multipv).forEach((variation) => {
              const scoreNum = (parseInt(variation.score) / 100).toFixed(2);
              const algebraicPV = convertPVToAlgebraic(variation.pv, currentFen);
              multipvHtml += `
                <div class="multipv-box" style="border: 1px solid #ccc; margin-bottom: 5px; padding: 5px;">
                  <div class="multipv-header" style="font-weight: bold;color: #aaa;">
                    Depth: ${variation.depth} | Eval: ${scoreNum}
                  </div>
                  <div class="multipv-pv" style="margin-top: 3px;">${algebraicPV}</div>
                </div>`;
            });
          }
          $(`#kibitzer${kibitzerNum}-pv`).html(multipvHtml);
        });
      },
      onerror: () => console.log("Failed querying backend")
    });

    scores[0][plyStr] = parseFloat($("#white-score").text());
    scores[1][plyStr] = parseFloat($("#black-score").text());

    // Update chart
    chart.data.datasets.forEach((dataset, i) => {
      dataset.data = labels.map((plyStr) => scores[i][plyStr] || null);
    });
    chart.update();
  }, 1000);

})();