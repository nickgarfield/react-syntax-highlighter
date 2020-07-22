import React from 'react';
import createElement from './create-element';

const newLineRegex = /\n/g;
function getNewLines(str) {
  return str.match(newLineRegex);
}

function getLineNumbers({ lines, startingLineNumber, numberProps = {} }) {
  return lines.map((_, i) => {
    const lineNumber =
      typeof startingLineNumber === 'string'
        ? startingLineNumber
        : i + startingLineNumber;
    const properties =
      typeof numberProps === 'function' ? numberProps(number) : numberProps;
    return (
      <span
        key={`line-${i}`}
        className="react-syntax-highlighter-line-number"
        {...properties}
      >
        {`${lineNumber}\n`}
      </span>
    );
  });
}

function LineNumbers({
  codeString,
  codeStyle,
  containerProps = {},
  numberProps,
  startingLineNumber
}) {
  containerProps.style = containerProps.style || {
    float: 'left',
    paddingRight: '10px'
  };
  return (
    <code
      // order ensures `containerProps.style` is merged with `codeStyle`
      {...containerProps}
      style={Object.assign({}, codeStyle, containerProps.style)}
    >
      {getLineNumbers({
        lines: codeString.replace(/\n$/, '').split('\n'),
        numberProps,
        startingLineNumber
      })}
    </code>
  );
}

function createLineElement({
  children,
  lineNumber,
  lineProps,
  className = []
}) {
  const properties =
    (typeof lineProps === 'function' ? lineProps(lineNumber) : lineProps) || {};
  properties.className = properties.className
    ? className.concat(properties.className)
    : className;
  return {
    type: 'element',
    tagName: 'span',
    properties,
    children
  };
}

function flattenCodeTree(tree, className = [], newTree = []) {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    if (node.type === 'text') {
      newTree.push(
        createLineElement({
          children: [node],
          className
        })
      );
    } else if (node.children) {
      const classNames = className.concat(node.properties.className);
      newTree = newTree.concat(flattenCodeTree(node.children, classNames));
    }
  }
  return newTree;
}

function wrapLinesInSpan(codeTree, lineProps) {
  const tree = flattenCodeTree(codeTree.value);
  const newTree = [];
  let lastLineBreakIndex = -1;
  let index = 0;
  while (index < tree.length) {
    const node = tree[index];
    const value = node.children[0].value;
    const newLines = getNewLines(value);
    if (newLines) {
      const splitValue = value.split('\n');
      splitValue.forEach((text, i) => {
        const lineNumber = newTree.length + 1;
        const newChild = { type: 'text', value: `${text}\n` };
        if (i === 0) {
          const children = tree.slice(lastLineBreakIndex + 1, index).concat(
            createLineElement({
              children: [newChild],
              className: node.properties.className
            })
          );
          newTree.push(createLineElement({ children, lineNumber, lineProps }));
        } else if (i === splitValue.length - 1) {
          const stringChild =
            tree[index + 1] &&
            tree[index + 1].children &&
            tree[index + 1].children[0];
          if (stringChild) {
            const lastLineInPreviousSpan = { type: 'text', value: `${text}` };
            const newElem = createLineElement({
              children: [lastLineInPreviousSpan],
              className: node.properties.className
            });
            tree.splice(index + 1, 0, newElem);
          } else {
            newTree.push(
              createLineElement({
                children: [newChild],
                lineNumber,
                lineProps,
                className: node.properties.className
              })
            );
          }
        } else {
          newTree.push(
            createLineElement({
              children: [newChild],
              lineNumber,
              lineProps,
              className: node.properties.className
            })
          );
        }
      });
      lastLineBreakIndex = index;
    }
    index++;
  }
  if (lastLineBreakIndex !== tree.length - 1) {
    const children = tree.slice(lastLineBreakIndex + 1, tree.length);
    if (children && children.length) {
      newTree.push(
        createLineElement({
          children,
          lineNumber: newTree.length + 1,
          lineProps
        })
      );
    }
  }
  return newTree;
}

function defaultRenderer({ rows, stylesheet, useInlineStyles }) {
  return rows.map((node, i) =>
    createElement({
      node,
      stylesheet,
      useInlineStyles,
      key: `code-segement${i}`
    })
  );
}

function getCodeTree({ astGenerator, language, code, defaultCodeValue }) {
  if (astGenerator.getLanguage) {
    const hasLanguage = language && astGenerator.getLanguage(language);
    if (language === 'text') {
      return { value: defaultCodeValue, language: 'text' };
    } else if (hasLanguage) {
      return astGenerator.highlight(language, code);
    } else {
      return astGenerator.highlightAuto(code);
    }
  }
  try {
    return language && language !== 'text'
      ? { value: astGenerator.highlight(code, language) }
      : { value: defaultCodeValue };
  } catch (e) {
    return { value: defaultCodeValue };
  }
}

export default function(defaultAstGenerator, defaultStyle) {
  return function SyntaxHighlighter({
    language,
    children,
    style = defaultStyle,
    customStyle = {},
    codeTagProps = { style: style['code[class*="language-"]'] },
    useInlineStyles = true,
    showLineNumbers = false,
    startingLineNumber = 1,
    lineNumberContainerProps,
    lineNumberProps,
    wrapLines,
    lineProps = {},
    renderer,
    PreTag = 'pre',
    CodeTag = 'code',
    code = Array.isArray(children) ? children[0] : children,
    astGenerator,
    ...rest
  }) {
    astGenerator = astGenerator || defaultAstGenerator;

    const lineNumbers = showLineNumbers ? (
      <LineNumbers
        containerProps={lineNumberContainerProps}
        codeStyle={codeTagProps.style || {}}
        numberProps={lineNumberProps}
        startingLineNumber={startingLineNumber}
        codeString={code}
      />
    ) : null;

    const defaultPreStyle = style.hljs ||
      style['pre[class*="language-"]'] || { backgroundColor: '#fff' };
    const preProps = useInlineStyles
      ? Object.assign({}, rest, {
          style: Object.assign({}, defaultPreStyle, customStyle)
        })
      : Object.assign({}, rest, { className: 'hljs' });

    if (!astGenerator) {
      return (
        <PreTag {...preProps}>
          {lineNumbers}
          <CodeTag {...codeTagProps}>{code}</CodeTag>
        </PreTag>
      );
    }

    /*
     * some custom renderers rely on individual row elements so we need to turn wrapLines on
     * if renderer is provided and wrapLines is undefined
     */
    wrapLines = renderer && wrapLines === undefined ? true : wrapLines;
    renderer = renderer || defaultRenderer;
    const defaultCodeValue = [{ type: 'text', value: code }];
    const codeTree = getCodeTree({
      astGenerator,
      language,
      code,
      defaultCodeValue
    });
    if (codeTree.language === null) {
      codeTree.value = defaultCodeValue;
    }

    const tree = wrapLines
      ? wrapLinesInSpan(codeTree, lineProps)
      : codeTree.value;

    return (
      <PreTag {...preProps}>
        {lineNumbers}
        <CodeTag {...codeTagProps}>
          {renderer({ rows: tree, stylesheet: style, useInlineStyles })}
        </CodeTag>
      </PreTag>
    );
  };
}
