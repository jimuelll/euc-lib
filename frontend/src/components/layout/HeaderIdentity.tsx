import { Link } from "react-router-dom";
export const HeaderBrand = ({to="/"}:{to?:string}) => (
<Link to={to} className="flex shrink-0 items-center gap-3 group">
            <img
              src="/aa1.ico"
              alt="Logo"
              className="h-8 w-8 object-contain opacity-90 shrink-0"
            />
            <div className="flex flex-col leading-none">
              <span
                className="text-primary-foreground text-xs font-bold tracking-[0.1em] uppercase"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                EUC Library
              </span>
              <span className="text-primary-foreground/80 text-[11px] tracking-[0.16em] uppercase hidden sm:block">
                Enverga-Candelaria Library
              </span>
            </div>
          </Link>
);
export const HeaderAvatar = ({ initials }: { initials: string }) => (
  <div
    className="h-8 w-8 bg-primary-foreground/15 border border-primary-foreground/30 text-primary-foreground text-xs font-bold tracking-widest flex items-center justify-center"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {initials}
  </div>
);

