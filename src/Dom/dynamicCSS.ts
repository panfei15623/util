import canUseDom from './canUseDom';
import contains from './contains';

const APPEND_ORDER = 'data-rc-order';
const MARK_KEY = `rc-util-key`;

const containerCache = new Map<Element, Node & ParentNode>();

export type Prepend = boolean | 'queue';
export type AppendType = 'prependQueue' | 'append' | 'prepend';

interface Options {
  attachTo?: Element;
  csp?: { nonce?: string };
  prepend?: Prepend;
  mark?: string;
}

function getMark({ mark }: Options = {}) {
  if (mark) {
    return mark.startsWith('data-') ? mark : `data-${mark}`;
  }
  return MARK_KEY;
}

function getContainer(option: Options) {
  if (option.attachTo) {
    return option.attachTo;
  }

  const head = document.querySelector('head');
  return head || document.body;
}

/**
 * getOrder 设置顺序
 * @param prepend: boolean | "queue"
 * @returns 'prependQueue' | 'append' | 'prepend'
 */
function getOrder(prepend?: Prepend): AppendType {
  if (prepend === 'queue') {
    return 'prependQueue';
  }

  return prepend ? 'prepend' : 'append';
}

/**
 * Find style which inject by rc-util
 */
function findStyles(container: Element) {
  return Array.from(
    (containerCache.get(container) || container).children,
  ).filter(node => node.tagName === 'STYLE') as HTMLStyleElement[];
}

/**
 * injectCSS 将 CSS 注入 style，默认加到 head 最后 
 * @param css 
 * @param option 
 * @returns 
 */
export function injectCSS(css: string, option: Options = {}) {
  if (!canUseDom()) {
    return null;
  }

  const { csp, prepend } = option;

  const styleNode = document.createElement('style');
  styleNode.setAttribute(APPEND_ORDER, getOrder(prepend));

  if (csp?.nonce) {
    styleNode.nonce = csp?.nonce;
  }
  styleNode.innerHTML = css;

  const container = getContainer(option);
  const { firstChild } = container;

  if (prepend) {
    // If is queue `prepend`, it will prepend first style and then append rest style
    if (prepend === 'queue') {
      const existStyle = findStyles(container).filter(node =>
        ['prepend', 'prependQueue'].includes(node.getAttribute(APPEND_ORDER)),
      );
      if (existStyle.length) {
        container.insertBefore(
          styleNode,
          existStyle[existStyle.length - 1].nextSibling,
        );

        return styleNode;
      }
    }

    // Use `insertBefore` as `prepend`
    container.insertBefore(styleNode, firstChild);
  } else {
    container.appendChild(styleNode);
  }

  return styleNode;
}

function findExistNode(key: string, option: Options = {}) {
  const container = getContainer(option);

  return findStyles(container).find(
    node => node.getAttribute(getMark(option)) === key,
  );
}

export function removeCSS(key: string, option: Options = {}) {
  const existNode = findExistNode(key, option);
  existNode?.parentNode?.removeChild(existNode);
}

/**
 * qiankun will inject `appendChild` to insert into other
 */
function syncRealContainer(container: Element, option: Options) {
  const cachedRealContainer = containerCache.get(container);

  // Find real container when not cached or cached container removed
  if (!cachedRealContainer || !contains(document, cachedRealContainer)) {
    const placeholderStyle = injectCSS('', option);
    const { parentNode } = placeholderStyle;
    containerCache.set(container, parentNode);
    parentNode.removeChild(placeholderStyle);
  }
}

export function updateCSS(css: string, key: string, option: Options = {}) {
  // 获取容器
  const container = getContainer(option);

  // Sync real parent
  syncRealContainer(container, option);

  const existNode = findExistNode(key, option);

  if (existNode) {
    if (option.csp?.nonce && existNode.nonce !== option.csp?.nonce) {
      existNode.nonce = option.csp?.nonce;
    }

    if (existNode.innerHTML !== css) {
      existNode.innerHTML = css;
    }

    return existNode;
  }

  const newNode = injectCSS(css, option);
  newNode.setAttribute(getMark(option), key);
  return newNode;
}
