import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  Loader2,
  RadioTower,
  RefreshCw,
  Server
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { getLiveHealth, getReadyHealth } from "../shared/api/health";
import { ApiError } from "../shared/api/http";
import type {
  HealthLiveResponse,
  HealthReadyResponse
} from "../shared/types/api";

export function HealthPage() {
  const [live, setLive] = useState<HealthLiveResponse | null>(null);
  const [ready, setReady] = useState<HealthReadyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth() {
    setLoading(true);
    setError(null);

    try {
      const [liveResponse, readyResponse] = await Promise.all([
        getLiveHealth(),
        getReadyHealth()
      ]);

      setLive(liveResponse);
      setReady(readyResponse);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  const apiAvailable = live?.status === "ok";
  const databaseOk = ready?.checks.database ?? false;
  const redisOk = ready?.checks.redis ?? false;
  const overallOk = ready?.status === "ok";

  return (
    <div className="page-grid">
      <Card>
        <CardHeader
          eyebrow="Сервисы"
          title="Состояние инфраструктуры"
          description="Проверка доступности API, базы данных и очереди задач. При сбое одного из сервисов анализ может не запускаться или завершаться неполно."
          action={
            <Button
              variant="secondary"
              onClick={loadHealth}
              disabled={loading}
              icon={
                loading ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )
              }
            >
              Обновить
            </Button>
          }
        />

        <div className="card-body">
          {error && (
            <div className="error-box">
              <strong>Ошибка</strong>
              <pre>{error}</pre>
            </div>
          )}

          <div className="health-grid">
            <article className="health-card">
              <div className="health-icon">
                <Server size={22} />
              </div>

              <span>API</span>
              <strong>{apiAvailable ? "Доступен" : "Недоступен"}</strong>

              <Badge tone={apiAvailable ? "success" : "danger"}>
                {apiAvailable ? "работает" : "сбой"}
              </Badge>
            </article>

            <article className="health-card">
              <div className="health-icon">
                <Activity size={22} />
              </div>

              <span>Готовность</span>
              <strong>{overallOk ? "Готово" : "Ограничено"}</strong>

              <Badge tone={overallOk ? "success" : "warning"}>
                {overallOk ? "все проверки пройдены" : "есть ограничения"}
              </Badge>
            </article>

            <article className="health-card">
              <div className="health-icon">
                <Database size={22} />
              </div>

              <span>База данных</span>
              <strong>{databaseOk ? "Доступна" : "Сбой"}</strong>

              <Badge tone={databaseOk ? "success" : "danger"}>
                {databaseOk ? "подключена" : "нет подключения"}
              </Badge>
            </article>

            <article className="health-card">
              <div className="health-icon">
                <RadioTower size={22} />
              </div>

              <span>Очередь задач</span>
              <strong>{redisOk ? "Доступна" : "Сбой"}</strong>

              <Badge tone={redisOk ? "success" : "danger"}>
                {redisOk ? "подключена" : "нет подключения"}
              </Badge>
            </article>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Диагностика"
          title="Ответы сервисных проверок"
          description="Сырые ответы можно использовать для диагностики при ошибках запуска анализа или проблемах с очередью задач."
        />

        <div className="card-body">
          <div className="raw-grid">
            <div className="raw-block">
              <strong>Проверка доступности API</strong>
              <pre>{JSON.stringify(live, null, 2)}</pre>
            </div>

            <div className="raw-block">
              <strong>Проверка готовности сервисов</strong>
              <pre>{JSON.stringify(ready, null, 2)}</pre>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getErrorMessage(exception: unknown): string {
  if (exception instanceof ApiError) {
    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Неизвестная ошибка";
}