export const loadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
};
