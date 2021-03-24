const TIKZPICTURE_WAITING_TIME = 3000;
const TIKZPICTURE_INTERVAL_TIME = 1000;

var scripts = document.getElementsByTagName('script');
var path = scripts[scripts.length - 1].src.slice(0, -11);

var latexjsScript = document.createElement('script');
latexjsScript.src = path + 'latex.js';
document.head.appendChild(latexjsScript);

var basicGenerator = 'basicGenerator';
var compiledTikz = new Map();

function fix(svg) {
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(svg, 'text/xml');
  var iriElementsAndProperties = {
    clipPath: ['clip-path'],
    'color-profile': ['color-profile'],
    cursor: ['cursor'],
    filter: ['filter'],
    linearGradient: ['fill', 'stroke'],
    marker: ['marker', 'marker-start', 'marker-mid', 'marker-end'],
    mask: ['mask'],
    pattern: ['fill', 'stroke'],
    radialGradient: ['fill', 'stroke'],
  };
  const elementDefs = xmlDoc.querySelectorAll('defs ' + '[id]');
  for (let i = 0; i < elementDefs.length; i++) {
    let def = elementDefs[i];
    let oldId = def.id;
    let newId = guid();
    def.id = newId;
    const uses = xmlDoc.querySelectorAll(`[*|href="#${oldId}"]`);
    Array.from(uses).forEach((use) => {
      use.setAttribute('xlink:href', '#' + newId);
    });
    Object.keys(iriElementsAndProperties).forEach((elem) => {
      let properties = iriElementsAndProperties[elem];
      properties.forEach((prop) => {
        let referencingElements = xmlDoc.querySelectorAll(
          '[' + prop + '*="' + oldId + '"]'
        );
        Array.from(referencingElements).forEach((refelem) => {
          refelem.setAttribute(prop, `url(#${newId})`);
        });
      });
    });
  }
  return xmlDoc.documentElement.outerHTML;
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function isObject(val) {
  if (val === null) {
    return false;
  }
  return typeof val === 'object';
}

function createCell(content) {
  if (
    content &&
    content.classList &&
    content.classList.contains('multicolumn')
  ) {
    return content;
  }

  let cell = document.createElement('div');
  cell.classList.add('cell');
  if (content) {
    cell.appendChild(content);
  } else {
    cell.classList.add('empty');
  }
  return cell;
}

function tikzpictureRequest(tikzpicture, id, tikzpictureOptions) {
  let container = document.querySelector(`.ltx #${id}`);

  let formdata = new FormData();
  formdata.append('tikzpicture', tikzpicture);

  var xhr = new XMLHttpRequest();
  xhr.open('POST', tikzpictureOptions.url);

  if (isObject(tikzpictureOptions.requestHeaders)) {
    for ([key, value] of Object.entries(tikzpictureOptions.requestHeaders)) {
      xhr.setRequestHeader(key, value);
    }
  }

  xhr.onreadystatechange = () => {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      if (xhr.status == 200) {
        svg = fix(xhr.responseText);
        container.innerHTML = svg;
        compiledTikz.set(tikzpicture, svg);
      } else {
        container.firstChild.classList.remove('loading');
        container.firstChild.src = path + 'img/error.svg';
        container.firstChild.title = xhr.responseText;
      }
    }
  };

  xhr.send(formdata);

  container.firstChild.src = path + 'img/loading.svg';
  container.firstChild.classList.add('loading');
  container.firstChild.title = 'loading';
}

function CustomGenerator(customArgs, customPrototype) {
  var generator = new latexjs.HtmlGenerator({
    CustomMacros: (function () {
      var args = (CustomMacros.args = customArgs),
        prototype = (CustomMacros.prototype = customPrototype);

      function CustomMacros(generator) {
        this.g = generator;
      }

      // CUSTOM MACROS

      // minipage
      args['minipage'] = ['V', 'k?', 'k'];
      prototype['minipage'] = function (adjustment, width) {
        let minipage = document.createElement('div');
        minipage.classList.add('minipage');
        if (width.includes('w')) {
          minipage.style.width = parseFloat(width.split('w')[0]) * 100 + '%';
        } else {
          minipage.style.width = width;
        }

        if (adjustment) {
          minipage.classList.add(adjustment);
        }
        return [minipage];
      };

      // fbox
      args['fbox'] = ['V', 'g'];
      prototype['fbox'] = function (content) {
        let fbox = document.createElement('div');
        fbox.classList.add('hbox');
        fbox.classList.add('frame');
        fbox.appendChild(content);
        return [fbox];
      };

      // table
      args['table'] = ['V'];
      prototype['table'] = function () {
        let tabCounter = this.g._counters.get('table');
        if (tabCounter % 1 === 0) {
          this.g._counters.set('table', tabCounter + 0.5);
        }
        this.g._counters.set(
          'figure',
          parseInt(this.g._counters.get('figure'))
        );

        let table = document.createElement('div');
        table.classList.add('table');

        return [table];
      };

      // tabular
      args['tabular'] = ['V', 'g', 'g'];
      prototype['tabular'] = function (template, content) {
        let tabular = document.createElement('div');
        tabular.classList.add('tabular');
        tabular.style.gridTemplateColumns = '';

        if (!template) {
          return [tabular];
        }
        if (template.childNodes.length > 0) {
          template = template.childNodes[0].wholeText;
        } else {
          template = template.data;
        }

        let gridTemplateColumns = '',
          columns = template;
        while (columns.includes('|')) {
          columns = columns.replace('|', '');
        }
        tabular.dataset.columns = columns.length;

        for (let i = 0; i < columns.length; i++) {
          if (columns[i] == 'p') {
            let e = columns.indexOf('}', i);
            let width = columns.substring(i + 2, e);
            if (width.includes('w')) {
              gridTemplateColumns +=
                parseFloat(width.split('w')[0]) * 100 + '%';
            } else {
              gridTemplateColumns += width;
            }
            i = e;
          } else {
            gridTemplateColumns += 'max-content';
          }

          if (i < columns.length - 1) {
            gridTemplateColumns += ' ';
          }
        }
        tabular.style.gridTemplateColumns = gridTemplateColumns;

        while (template.includes('{')) {
          let b = template.indexOf('{'),
            e = template.indexOf('}');
          template = template.substring(0, b) + template.substring(e + 1);
        }

        tabular.dataset.template = template;
        tabular.appendChild(createCell(content));
        return [tabular];
      };

      args['repeatcell'] = ['H', 'n', 'g'];
      prototype['repeatcell'] = function (number, column) {
        if (!column) {
          return [];
        }
        return [column.data.repeat(number)];
      };

      args['pcell'] = ['H', 'g'];
      prototype['pcell'] = function (length) {
        if (!length) {
          return [];
        }
        length = length.data;
        return ['p{' + length + '}'];
      };

      // hline
      args['hline'] = ['V', 'g'];
      prototype['hline'] = function (content) {
        return [document.createElement('hr'), createCell(content)];
      };

      // endline
      args['endline'] = ['V', 'g'];
      prototype['endline'] = function (content) {
        let endline = document.createElement('div');
        endline.classList.add('endline');
        return [endline, createCell(content)];
      };

      // nextcell
      args['nextcell'] = ['V', 'g'];
      prototype['nextcell'] = function (content) {
        return [createCell(content)];
      };

      // multicolumn
      args['multicolumn'] = ['V', 'n', 'k', 'g'];
      prototype['multicolumn'] = function (number, template, content) {
        if (!template) {
          throw {
            message: `syntax error: wrong multicolumn argument '${template}'`,
          };
        }

        let cell = document.createElement('div');
        cell.classList.add('cell');
        cell.classList.add('multicolumn');
        cell.dataset.columns = number;
        cell.dataset.template = template;

        if (content) {
          cell.appendChild(content);
        } else {
          cell.classList.add('empty');
        }

        return [cell];
      };

      // figure
      args['figure'] = ['V'];
      prototype['figure'] = function () {
        let figCounter = this.g._counters.get('figure');
        if (figCounter % 1 === 0) {
          this.g._counters.set('figure', figCounter + 0.5);
        }
        this.g._counters.set('table', parseInt(this.g._counters.get('table')));

        let figure = document.createElement('div');
        figure.classList.add('figure');

        return [figure];
      };

      // includegraphics
      args['includegraphics'] = ['V', 'kv?', 'u'];
      prototype['includegraphics'] = function (option, url) {
        let img = document.createElement('img');
        img.src = url;

        if (option && option.length > 0) {
          img.style.display = 'none';
          let [prop, val] = Object.entries(option[0])[0];
          if (prop == 'width' || prop == 'height') {
            if (val.includes('w')) {
              val = parseFloat(val.split('w')[0]) * 100 + '%';
            }
            img.style.setProperty(prop, val);
            img.style.removeProperty('display');
          } else if (prop == 'scale') {
            img.onload = function () {
              this.style.width = this.width * val + 'px';
              img.style.removeProperty('display');
            };
          }
        }

        return [img];
      };

      // caption
      args['caption'] = ['V', 'g'];
      prototype['caption'] = function (content) {
        let caption = document.createElement('p');
        caption.classList.add('caption');
        caption.appendChild(content);

        let figCounter = this.g._counters.get('figure'),
          tabCounter = this.g._counters.get('table');
        if (figCounter % 1 !== 0) {
          caption.dataset.number = Math.ceil(figCounter);
          this.g._counters.set('figure', figCounter + 1);
        } else if (tabCounter % 1 !== 0) {
          caption.dataset.number = Math.ceil(tabCounter);
          this.g._counters.set('table', tabCounter + 1);
        }

        return [caption];
      };

      // tikzpicture
      args['tikzpicture'] = ['V'];
      prototype['tikzpicture'] = function () {
        let container = document.createElement('div');
        container.classList.add('tikzpicture');

        let number = this.g.timeouts.length;
        let tickzpicture = this.g.tikzpictures[number],
            id = `tikzpicture-${number}`;
        if (compiledTikz.has(tickzpicture)) {
          this.g.timeouts.push(null);
          container.innerHTML = compiledTikz.get(tickzpicture);
          return [container];
        }

        if (!this.g.tikzpictureOptions.url) {
          let errorImg = document.createElement('img');
          errorImg.classList.add('tikzpicture');
          errorImg.src = path + 'img/error.svg';
          
          container.appendChild(errorImg);
          return [container];
        }

        if (!this.g.tikzpictureOptions.waitingTime) {
          this.g.tikzpictureOptions.waitingTime = TIKZPICTURE_WAITING_TIME;
        }
        if (!this.g.tikzpictureOptions.intervalTime) {
          this.g.tikzpictureOptions.intervalTime = TIKZPICTURE_INTERVAL_TIME;
        }

        
        let waitingTime =
          this.g.tikzpictureOptions.waitingTime +
          number * this.g.tikzpictureOptions.intervalTime;

        let tm = setTimeout(
          tikzpictureRequest,
          waitingTime,
          tickzpicture,
          id,
          this.g.tikzpictureOptions
        );
        this.g.timeouts.push(tm);

        let waitingImg = document.createElement('img');
        waitingImg.src = path + 'img/waiting.svg';
        waitingImg.title = `waiting (${waitingTime / 1000}s without writing)`;

        container.id = id;
        container.appendChild(waitingImg);
        return [container];
      };

      return CustomMacros;
    })(),
  });
  generator.tikzpictures = [];
  generator.timeouts = [];
  return generator;
}

function removeArgs(latex, command) {
  while (latex.includes(command + '{') || latex.includes(command + '[')) {
    let i =
      latex.indexOf(command + '{') > -1
        ? latex.indexOf(command + '{')
        : latex.indexOf(command + '[');
    let end = latex.indexOf(command + '{') > -1 ? '}' : ']';
    let e = latex.indexOf(end, i + command.length),
      endOfLine = latex.indexOf('\n', i + command.length);
    if (e == -1 || e > endOfLine) {
      throw {
        message: `syntax error: missing end of arguments '${end}'`,
      };
    }
    latex = latex.substring(0, i + command.length) + latex.substring(e + 1);
  }
  return latex;
}

// remove arguments that cannot be processed
function ltxclean(latex) {
  // clean itemize
  latex = removeArgs(latex, '\\begin{itemize}');

  // clean enumerate
  latex = removeArgs(latex, '\\begin{enumerate}');

  // textwidth
  while (latex.includes('\\textwidth')) {
    latex = latex.replace('\\textwidth', '\\linewidth');
  }

  // figure
  latex = removeArgs(latex, '\\begin{figure}');

  // table
  latex = removeArgs(latex, '\\begin{table}');

  return latex;
}

function ltx2html(
  latex,
  parentElement,
  tikzpictureOptions = {
    url: '',
    waitingTime: TIKZPICTURE_WAITING_TIME,
    intervalTime: TIKZPICTURE_INTERVAL_TIME,
    requestHeaders: {},
  },
  generator = basicGenerator
) {
  if (generator == 'basicGenerator') {
    latexjsScript.addEventListener('load', function () {
      ltx2html(latex, parentElement);
    });
  } else {
    // RESET
    generator.reset();
    for (tm of generator.timeouts) {
      clearTimeout(tm);
    }
    generator.timeouts = [];
    generator.tikzpictures = [];
    generator.tikzpictureOptions = tikzpictureOptions;

    // CLEAN
    latex = ltxclean(latex);

    // PRE PROCESSING

    // tikzpicture
    let i = 0,
      depth = 0,
      tikzpictureStart;
    while (
      latex.includes('\\begin{tikzpicture}', i) ||
      latex.includes('\\end{tikzpicture}', i)
    ) {
      let b = latex.indexOf('\\begin{tikzpicture}', i),
        e = latex.indexOf('\\end{tikzpicture}', i);
      if ((b > -1 && e > -1 && b < e) || (b > -1 && e == -1)) {
        if (depth == 0) {
          tikzpictureStart = b;
          depth++;
          i = b + 1;
        } else {
          throw {
            message: 'nested tikzpicture environments are not allowed',
          };
        }
      } else {
        if (depth == 1) {
          tikzpicture = latex.substring(tikzpictureStart, e + 17);
          generator.tikzpictures.push(tikzpicture);

          latex =
            latex.substring(0, tikzpictureStart) +
            '\\tikzpicture' +
            latex.substring(e + 17);

          depth--;
          i = tikzpictureStart;
        } else {
          throw {
            message: "environment 'tikzpicture' beginning is missing",
          };
        }
      }
    }
    if (depth > 0) {
      throw {
        message: "environment 'tikzpicture' is missing its end",
      };
    }

    // spaces
    while (latex.includes('\\:')) {
      latex = latex.replace('\\:', '\\,');
    }
    while (latex.includes('\\;')) {
      latex = latex.replace('\\;', '\\ ');
    }
    while (latex.includes('\\!')) {
      latex = latex.replace('\\!', '');
    }

    // linewidth
    while (latex.includes('\\linewidth')) {
      latex = latex.replace('\\linewidth', 'w');
    }
    // textwidth
    while (latex.includes('\\textwidth')) {
      latex = latex.replace('\\textwidth', 'w');
    }

    // tabular
    let spaces = [' ', '\n', '\t'];
    function setTabularMacros(latex) {
      let i = 0;
      while (latex.includes('\\hline', i)) {
        let h = latex.indexOf('\\hline', i);
        latex = latex.substring(0, h) + '}\\hline{' + latex.substring(h + 6);
        i = h + 2;
      }

      let mathMode = false;
      for (let i = 0; i < latex.length; i++) {
        if (latex[i] == '$') {
          mathMode = !mathMode;
        }

        if (!mathMode) {
          if (latex[i] == '&') {
            latex =
              latex.substring(0, i) + '}\\nextcell{' + latex.substring(i + 1);
            i--;
          } else if (
            spaces.includes(latex[i]) &&
            (i == 0 || i == latex.length - 1)
          ) {
            latex = latex.substring(0, i) + latex.substring(i + 1);
            i--;
          } else if (i < latex.length - 1) {
            if (latex[i] == '\\' && latex[i + 1] == '\\') {
              latex =
                latex.substring(0, i) + '}\\endline{' + latex.substring(i + 2);
              i--;
            } else if (latex[i] == '{' && spaces.includes(latex[i + 1])) {
              latex = latex.substring(0, i + 1) + latex.substring(i + 2);
              i--;
            }
          }
          if (
            i > 0 &&
            spaces.includes(latex[i - 1]) &&
            (spaces.includes(latex[i]) || latex[i] == '}')
          ) {
            latex = latex.substring(0, i - 1) + latex.substring(i);
            i -= 2;
          }
        }
      }
      return latex;
    }

    i = 0;
    depth = 0;
    let firstStart;
    while (
      latex.includes('\\begin{tabular}', i) ||
      latex.includes('\\end{tabular}', i)
    ) {
      let b = latex.indexOf('\\begin{tabular}', i),
        e = latex.indexOf('\\end{tabular}', i);
      console.log(i, b, e, depth);
      if ((b > -1 && e > -1 && b < e) || (b > -1 && e == -1)) {
        if (latex.indexOf('\\begin{tabular}{', i) == b) {
          let argsStart = latex.indexOf('}{', b) + 2;
          let argsEnd = argsStart,
            stack = 0;
          while (
            (stack > 0 || latex[argsEnd] != '}') &&
            argsEnd < latex.length
          ) {
            if (latex[argsEnd] == '{') {
              stack++;
            } else if (latex[argsEnd] == '}') {
              stack--;
            }
            argsEnd++;
          }
          if (argsEnd == latex.length) {
            break;
          }
          let args = latex.substring(argsStart, argsEnd);
          while (args.includes(' ')) {
            args = args.replace(' ', '');
          }

          let j = args.indexOf('p');
          while (j > -1) {
            args = args.substring(0, j) + '\\pcell' + args.substring(j + 1);
            j = args.indexOf('p', j + 2);
          }
          while (args.includes('*')) {
            args = args.replace('*', '\\repeatcell');
          }

          latex =
            latex.substring(0, argsStart) +
            args +
            '}{' +
            latex.substring(argsEnd + 1);
          i = argsStart + args.length + 2;

          if (depth == 0) {
            firstStart = i;
          }
        } else {
          i = b + 1;
        }
        depth++;
      } else {
        console.log(depth);
        depth--;
        latex = latex.substring(0, e) + '}' + latex.substring(e);

        if (depth == 0 && firstStart) {
          tabularLatex = setTabularMacros(latex.substring(firstStart, e));
          latex =
            latex.substring(0, firstStart) + tabularLatex + latex.substring(e);
          i = firstStart + tabularLatex.length + 2;
        } else {
          i = e + 2;
        }
      }
    }
    console.log(1, latex)

    const ltx = `\\documentclass{article}

\\usepackage{comment, multicol}
\\usepackage{hyperref}
\\usepackage{calc,pict2e,picture}
\\usepackage{textgreek,textcomp,gensymb,stix}

\\begin{document}

${latex}

\\end{document}`;

    // MAIN PROCESSING
    try {
      generator = latexjs.parse(ltx, { generator: generator });
    } catch (e) {
      console.log(e);
      // return error
      throw {
        message: e.message,
      };
    }

    let child = generator.domFragment().firstChild;

    // POST PROCESSING

    // line break at the end paragraphs
    while (child.innerHTML.includes('<p><br></p>')) {
      child.innerHTML = child.innerHTML.replace('<p><br></p>', '<p>&nbsp;</p>');
    }
    while (child.innerHTML.includes('<br></p>')) {
      child.innerHTML = child.innerHTML.replace('<br></p>', '<br>&nbsp;</p>');
    }

    // minipage width inside fbox
    for (minipage of child.getElementsByClassName('minipage')) {
      let parent = minipage.parentElement;
      if (parent.classList.contains('hbox')) {
        if (parent.style.width) {
          parent.style.width =
            parent.style.width.slice(0, -1) + minipage.style.width + ')';
        } else {
          parent.style.width = 'calc(' + minipage.style.width + ')';
        }
        minipage.style.removeProperty('width');
      }
    }

    // tabular
    function applyStyle(elements, property, value) {
      for (el of elements) {
        el.style.setProperty(property, value);
      }
    }

    for (tabular of child.getElementsByClassName('tabular')) {
      let cells = [];
      (col = 0), (columns = parseInt(tabular.dataset.columns));

      if (columns) {
        while (columns--) cells.push([]);

        for (el of tabular.children) {
          if (el.classList.contains('cell')) {
            if (el.classList.contains('multicolumn')) {
              let c = parseInt(el.dataset.columns);
              el.style.gridColumn = col + 1 + '/' + (col + 1 + c);

              let template = el.dataset.template;
              try {
                if (col == 0 && template.startsWith('||')) {
                  el.style.borderLeft = '4px double black';
                  template = template.substring(2);
                } else if (col == 0 && template.startsWith('|')) {
                  el.style.borderLeft = '1px solid black';
                  template = template.substring(1);
                }
                if (template[0] == 'c') {
                  el.style.textAlign = 'center';
                } else if (template[0] == 'r') {
                  el.style.textAlign = 'right';
                }
                template = template.substring(1);
                if (template == '||') {
                  el.style.borderRight = '4px double black';
                } else if (template == '|') {
                  el.style.borderRight = '1px solid black';
                }
              } catch (e) {
                throw {
                  message: `syntax error: wrong multicolumn argument '${template}'`,
                };
              }
              col += c;
            } else {
              cells[col].push(el);

              col++;
              if (col == cells.length) {
                col = 0;
              }
            }
          } else {
            col = 0;
          }
        }

        let template = tabular.dataset.template;
        col = 0;
        for (let i = 0; i < template.length; i++) {
          if (
            i < template.length - 1 &&
            template[i] == '|' &&
            template[i + 1] == '|'
          ) {
            if (i == 0) {
              applyStyle(cells[col], 'border-left', 'double black 4px');
            } else {
              applyStyle(cells[col - 1], 'border-right', 'double black 4px');
            }
            i++;
          } else if (template[i] == '|') {
            if (i == 0) {
              applyStyle(cells[col], 'border-left', '1px solid black');
            } else {
              applyStyle(cells[col - 1], 'border-right', '1px solid black');
            }
          } else {
            if (template[i] == 'c') {
              applyStyle(cells[col], 'text-align', 'center');
            } else if (template[i] == 'r') {
              applyStyle(cells[col], 'text-align', 'right');
            } else if (template[i] == 'p') {
              applyStyle(cells[col], 'text-align', 'justify');
            }
            col++;
          }
        }
      }
    }

    // DISPLAY
    parentElement.innerHTML = '';
    if (!parentElement.classList.contains('ltx')) {
      parentElement.classList.add('ltx');
    }
    parentElement.appendChild(child);
  }
}

latexjsScript.addEventListener('load', function () {
  basicGenerator = CustomGenerator({}, {});
  basicGenerator = latexjs.parse(
    '\\documentclass{article}\n\\begin{document}\n\\end{document}',
    { generator: basicGenerator }
  );
  document.head.appendChild(basicGenerator.stylesAndScripts(path));
});
