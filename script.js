let nodeIdCounter = 0; // ノードごとに一意のIDを付与するためのカウンタ

/**
 * DOM要素とその子要素に一意のIDを再帰的に付与する
 * @param {Element} element - ID付与対象のDOM要素
 */
function assignIdsToElements(element) {
  if (element.nodeType === 1) {
    const uniqueId = `node-${nodeIdCounter++}`;
    element.setAttribute("data-node-id", uniqueId);
    element.childNodes.forEach((child) => {
      assignIdsToElements(child);
    });
  }
}

/**
 * DOM要素をツリー構造のデータに変換する
 * @param {Element} element - 変換対象のDOM要素
 * @returns {Object|null} ツリー構造のデータオブジェクト、または要素がない場合はnull
 */
function convertToTree(element) {
  if (element.nodeType !== 1) {
    return null;
  }

  const nodeId = element.getAttribute("data-node-id");
  const textContent = element.textContent.trim();

  const children = [];
  element.childNodes.forEach((child) => {
    const childTree = convertToTree(child);
    if (childTree) {
      children.push(childTree);
    }
  });

  return {
    nodeId: nodeId,
    name: element.tagName.toLowerCase(),
    textContent: textContent,
    children: children,
  };
}

/**
 * HTMLをiframe内にレンダリングする
 * @param {string} html - レンダリングするHTML文字列
 */
function renderHTML(html) {
  const iframe = document.getElementById("renderedFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}

/**
 * レンダリングされたHTML要素にクリックイベントを追加する
 */
function addClickEventsToRenderedElements() {
  const iframe = document.getElementById("renderedFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;

  doc.querySelectorAll("[data-node-id]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const clickedId = el.getAttribute("data-node-id");
      highlightTreeNode(clickedId);
    });
  });
}

/**
 * ツリー表示のハイライトをリセットする
 */
function resetTreeHighlights() {
  d3.selectAll(".node").classed("highlighted-node", false);
}

/**
 * HTML表示のハイライトをリセットする
 */
function resetHTMLHighlights() {
  const iframe = document.getElementById("renderedFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.querySelectorAll(".highlighted").forEach((el) => {
    el.classList.remove("highlighted");
  });
  doc.querySelectorAll(".hovered").forEach((el) => {
    el.classList.remove("hovered");
  });
}

/**
 * 指定されたノードIDに対応するツリーとHTML要素をハイライトする
 * @param {string} nodeId - ハイライトするノードのID
 */
function highlightTreeNode(nodeId) {
  resetTreeHighlights();
  d3.selectAll(".node").each(function (d) {
    if (d.data.nodeId === nodeId) {
      d3.select(this).classed("highlighted-node", true);
    }
  });
  resetHTMLHighlights();
  const iframe = document.getElementById("renderedFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const el = doc.querySelector(`[data-node-id='${nodeId}']`);
  if (el) {
    el.classList.add("highlighted");
  }
}

/**
 * HTML側の要素をホバー状態でハイライトする
 * @param {string} nodeId - ハイライトするノードのID
 */
function highlightHTMLSide(nodeId) {
  const iframe = document.getElementById("renderedFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const el = doc.querySelector(`[data-node-id='${nodeId}']`);
  if (el) {
    el.classList.add("hovered");
  }
}

/**
 * HTML側の要素のホバーハイライトを解除する
 * @param {string} nodeId - ハイライトを解除するノードのID
 */
function unhighlightHTMLSide(nodeId) {
  const iframe = document.getElementById("renderedFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const el = doc.querySelector(`[data-node-id='${nodeId}']`);
  if (el) {
    el.classList.remove("hovered");
  }
}

/**
 * D3.jsを使用してツリー構造を描画する
 * @param {Object} rootData - 描画するツリーデータのルートノード
 */
function drawTree(rootData) {
  const svg = d3.select("#treeViz");
  svg.selectAll("*").remove();

  const width = +svg.node().getBoundingClientRect().width;
  const height = +svg.node().getBoundingClientRect().height;

  const gContainer = svg.append("g");

  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 2])
    .on("zoom", (event) => {
      gContainer.attr("transform", event.transform);
    });
  svg.call(zoom);

  const hierarchyData = d3.hierarchy(rootData);
  const treeLayout = d3.tree().size([width - 100, height - 100]);
  treeLayout(hierarchyData);

  gContainer
    .selectAll(".link")
    .data(hierarchyData.links())
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  const node = gContainer
    .selectAll(".node")
    .data(hierarchyData.descendants())
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  node
    .append("circle")
    .attr("r", 8)
    .on("click", (event, d) => {
      event.stopPropagation();
      highlightTreeNode(d.data.nodeId);
    })
    .on("mouseover", (event, d) => {
      highlightHTMLSide(d.data.nodeId);
    })
    .on("mouseout", (event, d) => {
      unhighlightHTMLSide(d.data.nodeId);
    });

  node.append("title").text((d) => {
    if (d.data.textContent) {
      return `${d.data.name} : ${d.data.textContent}`;
    } else {
      return d.data.name;
    }
  });

  node
    .append("text")
    .attr("dy", -15)
    .text((d) => d.data.name);
}

/**
 * テキストエリアに入力されたHTMLからツリーを生成し、
 * ツリー表示とHTML表示の両方を更新する
 */
function updateTree() {
  const html = document.getElementById("htmlInput").value;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  nodeIdCounter = 0;
  assignIdsToElements(doc.documentElement);

  renderHTML(doc.documentElement.outerHTML);

  const treeData = convertToTree(doc.documentElement);
  if (treeData) {
    drawTree(treeData);
  }

  setTimeout(() => {
    addClickEventsToRenderedElements();
  }, 100);
}
