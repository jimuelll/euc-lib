import { useEffect, useState, type CSSProperties } from "react";
const colors = ["#8b1111", "#2c3e50", "#2c5a4a", "#9a4d12", "#4a2c5a"];
export const CardThumbnail = ({ imageUrl, title, index, alt }: { imageUrl: string | null; title: string; index: number; alt?: string }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  return <div className={"subscription-logo" + (title.length > 8 ? " is-long" : "")} style={{ "--subscription-color": colors[index % colors.length] } as CSSProperties}>
    {imageUrl && !failed ? <img src={imageUrl} alt={alt ?? title} loading="lazy" onError={() => setFailed(true)} /> : <span aria-hidden="true">{title}</span>}
  </div>;
};
