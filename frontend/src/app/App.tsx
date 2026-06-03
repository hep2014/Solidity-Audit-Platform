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
            <h1>Платформа аудита смарт-контрактов</h1>
            <p>
              Загрузка Solidity-проектов, запуск статического анализа, фаззинга,
              символьного исполнения и дополнительных проверок потоков управления
              и данных. Результаты разделяются на уязвимости, ошибки анализаторов,
              ручные проверки и технические логи.
            </p>
          </div>

          <div className="hero-status">
            <div className="hero-status-card">
              <span>Пайплайн анализа</span>
              <strong>Slither · Mythril · Foundry · Echidna</strong>
            </div>

            <div className="hero-status-card">
              <span>Дополнительные проверки</span>
              <strong>CFG · DFG · корреляция реентерабельности</strong>
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          <NavLink to="/" end>
            <Gauge size={16} />
            Обзор
          </NavLink>

          <NavLink to="/projects">
            <FolderKanban size={16} />
            Проекты
          </NavLink>

          <NavLink to="/quick-scan">
            <FileSearch size={16} />
            Быстрая проверка
          </NavLink>

          <NavLink to="/health">
            <Activity size={16} />
            Сервисы
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