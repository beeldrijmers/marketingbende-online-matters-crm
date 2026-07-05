import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Welcome = () => (
  <Card>
    <CardHeader>
      <CardTitle>Welkom bij het CRM</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground mb-4">
        Dit is het interne CRM van Marketingbende x Online Matters. Hier beheer
        je contacten, bedrijven, deals en taken op een centrale plek.
      </p>
      <p className="text-sm text-muted-foreground">
        Je bekijkt op dit moment demogegevens. Deze worden bij het herladen van
        de pagina teruggezet naar de uitgangssituatie; in de productieomgeving
        werkt het CRM met een Supabase-backend.
      </p>
    </CardContent>
  </Card>
);
