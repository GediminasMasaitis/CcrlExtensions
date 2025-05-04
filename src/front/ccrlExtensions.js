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
    let isWhiteToMove = chess.turn() === 'w';

    moves.forEach((move, i) => {
      let moveObj = chess.move(move, { sloppy: true });
      if (!moveObj) return;

      if (isWhiteToMove) {
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
            white: "...",  // <-- Place "..." after move number when Black moves first
            black: moveObj.san
          });
        }
        currentMoveNumber++;
      }

      isWhiteToMove = chess.turn() === 'w';
    });

    return groups.map(group => {
      let moveNumberHtml = `<span style="color: #f5c276; font-weight: bold;">${group.moveNumber}.</span>`;
      let whiteMove = group.white ? `<span style="color: #ffffff;">${group.white}</span>` : '';
      let blackMove = group.black ? `<span style="color: #ffffff;">${group.black}</span>` : '';

      return `${moveNumberHtml} ${whiteMove} ${blackMove}`.trim();
    }).join(" ");
  };

  // A helper function to parse the score string into a numeric value and display string
  const parseScore = (scoreText) => {
    scoreText = scoreText.trim();
    // Format: "+MX" where X is a positive integer (mate for white)
    if (scoreText.startsWith("+M")) {
      const mateMoves = parseInt(scoreText.substring(2));

      // Use a high constant (e.g. 1000) so that mate scores are always above normal evals.
      const value = 30 - (isNaN(mateMoves) ? 0 : mateMoves * 0.01);
      return { value: value, tooltip: scoreText };
    }
    // Format: "-MX" where X is a positive integer (mate for black)
    else if (scoreText.startsWith("-M")) {
      const mateMoves = parseInt(scoreText.substring(2));
      // Use a low constant so that mate scores are always below normal evals.
      const value = -30 + (isNaN(mateMoves) ? 0 : mateMoves * 0.01);
      return { value: value, tooltip: scoreText };
    }
    else {
      const numStr = scoreText;
      const value = Math.min(Math.max(parseFloat(numStr), -20), 20);
      if (!isNaN(value)) {
        return { value: value, tooltip: scoreText };
      }
    }
    // If none of the formats match, return null.
    return null;
  }

  // Create page layout
  const container = $('.container').css('max-width', '180vh');

  // Create a wrapper for the whole page content
  const pageWrapper = $('<div id="page-wrapper"></div>').css({
    'display': 'flex',
    'flex-direction': 'row',
    'width': '100%',
    'gap': '15px'
  });

  // Move all existing content from the container to a main content div
  const mainContent = $('<div id="main-content"></div>').css({
    'flex': '7',
    'min-width': '0'
  });

  // Create the sidebar for analysis
  const sidebarAnalysis = $('<div id="sidebar-analysis"></div>').css({
    'flex': '3',
    'display': 'flex',
    'flex-direction': 'column',
    'gap': '15px', 
    'min-width': '0',
    'max-width': 'none'
  });

  // Move existing container children to mainContent
  container.children().appendTo(mainContent);

  // Clear container and add our new structure
  container.empty().append(pageWrapper);
  pageWrapper.append(mainContent).append(sidebarAnalysis);

  // Create the first kibitzer
  const kibitzerInfo1 = $(`<div id="kibitzer1-info"></div>`).css({
    'margin-bottom': '15px',
    'overflow': 'auto',
    'max-height': '30vh'
  });

  sidebarAnalysis.append(kibitzerInfo1);

  kibitzerInfo1
    .append(`<h3 id="kibitzer1-name">Kibitzer 1 inactive</h3>`)
    .append(`
      <div class="card fluid">
        <div class="row">
          <div class="col-sm">
            <div class="row">
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Score</small></p>
                <p class="small-margin info-value" id="kibitzer1-score">0</p>
              </div>
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Depth</small></p>
                <p class="small-margin info-value" id="kibitzer1-depth">0</p>
              </div>
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Nodes</small></p>
                <p class="small-margin info-value" id="kibitzer1-nodes">0</p>
              </div>
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Nps</small></p>
                <p class="small-margin info-value" id="kibitzer1-nps">0</p>
              </div>
            </div>
          </div>
          <div class="col-sm-3" style="text-align: right">
            <h3><small id="kibitzer1-time"><mark>&#8734;</mark></small></h3>
          </div>
          <div class="col-sm-12">
            <p class="pv"><small id="kibitzer1-pv"></small></p>
          </div>
        </div>
      </div>
    `)
    .append(`<p class="mainline" id="kibitzer1-mainline" style="margin-top: 5px; font-style: italic;"></p>`);

  // Setup chart container
  const evalChartContainer = $('<div id="eval-chart-container"><canvas id="eval-chart"></canvas></div>').css({
    'width': '100%',
    'height': '300px',
    'margin-bottom': '15px'
  });

  // Append the chart container to the sidebar
  sidebarAnalysis.append(evalChartContainer);

  // Create the second kibitzer (placed after the chart)
  const kibitzerInfo2 = $(`<div id="kibitzer2-info"></div>`).css({
    'margin-bottom': '15px',
    'overflow': 'auto',
    'max-height': '30vh'
  });

  sidebarAnalysis.append(kibitzerInfo2);

  kibitzerInfo2
    .append(`<h3 id="kibitzer2-name">Kibitzer 2 inactive</h3>`)
    .append(`
      <div class="card fluid">
        <div class="row">
          <div class="col-sm">
            <div class="row">
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Score</small></p>
                <p class="small-margin info-value" id="kibitzer2-score">0</p>
              </div>
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Depth</small></p>
                <p class="small-margin info-value" id="kibitzer2-depth">0</p>
              </div>
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Nodes</small></p>
                <p class="small-margin info-value" id="kibitzer2-nodes">0</p>
              </div>
              <div class="col-sm info">
                <p class="small-margin"><small class="info-header">Nps</small></p>
                <p class="small-margin info-value" id="kibitzer2-nps">0</p>
              </div>
            </div>
          </div>
          <div class="col-sm-3" style="text-align: right">
            <h3><small id="kibitzer2-time"><mark>&#8734;</mark></small></h3>
          </div>
          <div class="col-sm-12">
            <p class="pv"><small id="kibitzer2-pv"></small></p>
          </div>
        </div>
      </div>
    `)
    .append(`<p class="mainline" id="kibitzer2-mainline" style="margin-top: 5px; font-style: italic;"></p>`);

  const ctx = $("#eval-chart")[0];
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
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
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const pt = context.raw;
              // If pt is an object and has tooltip, return that. Otherwise, use the y value.
              return pt.tooltip || pt.y;
            }
          }
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

  // Register a MutationObserver to look at fen changes
  const fenElement = document.getElementById('fen');
  if (fenElement) {
    const observer = new MutationObserver((mutationsList) => {
      // Send the new fen to the backend
      sendFen();
    });
    // Observe the fen textbox
    observer.observe(fenElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Update the graph and kibitzers every second
  setInterval(() => {
    const fen = getFen();
    if (!fen) return;

    // Correct ply calculation
    const fenParts = fen.split(" ");
    const fullmoveNumber = parseInt(fenParts[5]) || 1;
    const activeColor = fenParts[1];
    const ply = (fullmoveNumber - 1) * 2 + (activeColor === 'b' ? 1 : 0);
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
          $(`#kibitzer${kibitzerNum}-score`).text(parseScore(info.score).tooltip);
          $(`#kibitzer${kibitzerNum}-depth`).text(info.depth);
          $(`#kibitzer${kibitzerNum}-nodes`).text(formatCompactNumber(info.nodes));
          $(`#kibitzer${kibitzerNum}-nps`).text(formatCompactNumber(info.nps));

          // Update kibitzer scores and labels for the chart (positions 2 and 3 in the scores array)
          const datasetIndex = 2 + index;
          scores[datasetIndex][plyStr] = { x: plyStr, y: parseScore(info.score).value, tooltip: parseScore(info.score).tooltip };
          chart.data.datasets[datasetIndex].label = info.name;

          let multipvHtml = "";
          if (info.multipv) {
            info.multipv.sort((a, b) => a.orderKey - b.orderKey).forEach((variation) => {
              const algebraicPV = convertPVToAlgebraic(variation.pv, currentFen);
              multipvHtml += `
                <div class="multipv-box" style="border: 1px solid #ccc; margin-bottom: 5px; padding: 5px;">
                  <div class="multipv-header" style="font-weight: bold;color: #aaa;">
                    Depth: ${variation.depth} | Eval: ${variation.score}
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

    // Handle White and Black scores with validation
    const whiteScoreText = $("#white-score").text();
    const blackScoreText = $("#black-score").text();
    const whiteScore = parseFloat(whiteScoreText);
    const blackScore = parseFloat(blackScoreText);

    if (!isNaN(whiteScore)) {
      scores[0][plyStr] = { x: plyStr, y: whiteScore, tooltip: whiteScore.toString() };
    }
    if (!isNaN(blackScore)) {
      scores[1][plyStr] = { x: plyStr, y: blackScore, tooltip: blackScore.toString() };
    }

    // Update chart datasets
    chart.data.datasets.forEach((dataset, i) => {
      dataset.data = labels.map(plyStr => {
        const scoreObj = scores[i][plyStr];
        return scoreObj ? scoreObj : { x: plyStr, y: null };
      });
    });
    chart.update();
  }, 1000);

})();
