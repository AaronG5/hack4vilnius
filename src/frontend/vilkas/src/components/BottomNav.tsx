import { NavLink } from "react-router-dom";
import { FlagIcon, MapIcon, UserIcon } from "./icons";
import "./BottomNav.css";

const ITEMS = [
  { to: "/map", label: "Žemėlapis", Icon: MapIcon },
  { to: "/challenges", label: "Iššūkiai", Icon: FlagIcon },
  { to: "/profile", label: "Profilis", Icon: UserIcon },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Pagrindinė navigacija">
      {ITEMS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className="bottom-nav__item">
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
