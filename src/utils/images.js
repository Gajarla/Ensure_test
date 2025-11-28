export const openInNewTab = (screenShot) => {
  const image = new Image();
  image.src = screenShot;

  const w = window.open('');
  w.document.write(image.outerHTML);
};
