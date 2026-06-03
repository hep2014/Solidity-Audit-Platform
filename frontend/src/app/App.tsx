import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  FileSearch,
  FolderKanban,
  Gauge,
  ShieldCheck
} from "lucide-react";

export function App() {
  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="eyebrow">SOLIDITY AUDIT PLATFORM</div>

        <div className="hero-grid">
          <div>
            <h1>Анализ Solidity-контрактов</h1>
            <p>
              Учебная платформа для загрузки смарт-контрактов, запуска статического
              анализа, fuzzing, символьного исполнения, CFG/DFG-проверок и просмотра
              подробных логов выполнения.
            </p>
          </div>

          <div className="hero-status">
            <div className="hero-status-card">
              <span>Pipeline</span>
              <strong>Slither · Mythril · Foundry · Echidna</strong>
            </div>
            <div className="hero-status-card">
              <span>Custom checks</span>
              <strong>CFG · DFG · Reentrancy</strong>
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          <NavLink to="/" end>
            <Gauge size={16} />
            Главная
          </NavLink>
          <NavLink to="/projects">
            <FolderKanban size={16} />
            Проекты
          </NavLink>
          <NavLink to="/quick-scan">
            <FileSearch size={16} />
            Quick Scan
          </NavLink>
          <NavLink to="/health">
            <Activity size={16} />
            Health
          </NavLink>
          <a href="https://soliditylang.org/" target="_blank" rel="noreferrer">
            <ShieldCheck size={16} />
            Solidity
          </a>
        </nav>
      </header>

      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}