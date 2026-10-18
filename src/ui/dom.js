/* Utilitários de DOM. Todo texto entra via textContent, nunca via innerHTML. */

export const $ = function (s) {
  return document.querySelector(s);
};
export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export function el(tag, attrs, text) {
  const e = document.createElement(tag);
  if (attrs)
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
export function clear(node) {
  node.replaceChildren();
  return node;
}
