import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";

export function NotFoundPage() {
  return (
    <Card>
      <CardHeader
        eyebrow="404"
        title="Страница не найдена"
        description="Такого маршрута во frontend-приложении нет."
        action={
          <Link to="/">
            <Button variant="secondary" icon={<ArrowLeft size={16} />}>
              На главную
            </Button>
          </Link>
        }
      />
    </Card>
  );
}