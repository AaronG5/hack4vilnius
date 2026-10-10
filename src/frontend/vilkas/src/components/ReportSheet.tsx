// "Pranešti apie problemą" sheet opened by the FAB on the map.

import { Link } from "react-router-dom";
import { CameraIcon, MicIcon, PencilIcon, VideoIcon } from "./icons";
import "./ReportSheet.css";

export type ReportMode = "photo" | "video" | "audio" | "text";

const OPTIONS: { mode: ReportMode; title: string; hint: string; color: string; Icon: typeof CameraIcon }[] = [
  { mode: "photo", title: "Nufotografuoti", hint: "Duobėms, šiukšlėms, pažeidimams", color: "var(--red)", Icon: CameraIcon },
  { mode: "video", title: "Nufilmuoti", hint: "Eismui, pavojingoms perėjoms", color: "var(--pink)", Icon: VideoIcon },
  { mode: "audio", title: "Įrašyti garsą", hint: "Triukšmui ar apibūdinti žodžiais", color: "var(--ink)", Icon: MicIcon },
  { mode: "text", title: "Aprašyti tekstu", hint: "Negalite fotografuoti, pvz., autobuse? Nuotrauką pridėsite vėliau", color: "var(--green)", Icon: PencilIcon },
];

export function ReportSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="report-sheet__scrim" onClick={onClose} aria-hidden="true" />
      <div className="report-sheet notch-lg" role="dialog" aria-modal="true" aria-labelledby="report-sheet-title">
        <div className="report-sheet__head">
          <h1 id="report-sheet-title">Pranešti apie problemą</h1>
          <span>Parodykite arba papasakokite — DI užpildys detales, o jūs jas patikrinsite.</span>
        </div>
        {OPTIONS.map(({ mode, title, hint, color, Icon }) => (
          <Link key={mode} to={`/report/new?mode=${mode}`} className="report-sheet__option notch">
            <span className="report-sheet__icon" style={{ background: color }}>
              <Icon />
            </span>
            <span className="report-sheet__text">
              <span className="report-sheet__title">{title}</span>
              <span className="report-sheet__hint">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
