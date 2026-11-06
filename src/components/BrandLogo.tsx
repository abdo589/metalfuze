import logo from "@/assets/metal-fuze-logo.png.asset.json";
import lightLogo from "@/assets/metal-fuze-logo-light.png.asset.json";
import smallLogo from "@/assets/metal-fuze-logo-320.webp.asset.json";
import largeLogo from "@/assets/metal-fuze-logo-768.webp.asset.json";
import smallLightLogo from "@/assets/metal-fuze-logo-light-320.webp.asset.json";
import largeLightLogo from "@/assets/metal-fuze-logo-light-768.webp.asset.json";

/** Screen-sized lossless logos; original PNGs remain the fallback and print source. */
export function BrandLogo({ className, sizes }: { className: string; sizes: string }) {
  return <>
    <picture className="logo-on-light">
      <source type="image/webp" srcSet={`${smallLogo.url} 320w, ${largeLogo.url} 768w`} sizes={sizes} />
      <img src={logo.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665} className={`screen-logo ${className}`} />
    </picture>
    <picture className="logo-on-dark hidden">
      <source type="image/webp" srcSet={`${smallLightLogo.url} 320w, ${largeLightLogo.url} 768w`} sizes={sizes} />
      <img src={lightLogo.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665} className={`screen-logo ${className}`} />
    </picture>
  </>;
}