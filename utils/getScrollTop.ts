export default function() {
  return document.documentElement.scrollTop || window.pageYOffset || document.body.scrollTop;
}
