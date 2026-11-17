import { developer } from "@/lib/credits";
import {
  Body,
  Container,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
export function AppointmentEmail({
  salon,
  text,
  url,
  team = false,
}: {
  salon: string;
  text: string;
  url: string;
  team?: boolean;
}) {
  return (
    <Html lang="es">
      <Preview>{text.slice(0, 100)}</Preview>
      <Body style={{ background: "#faf7f4", fontFamily: "Arial" }}>
        <Container style={{ padding: 32 }}>
          <Heading style={{ color: "#754c60", fontFamily: "Georgia" }}>
            {salon}
          </Heading>
          <Text style={{ lineHeight: "26px", whiteSpace: "pre-line" }}>
            {text}
          </Text>
          <Link href={url}>
            {team
              ? "Abrir mi agenda"
              : "Gestionar mi cita y compartir mi experiencia"}
          </Link>
          <Text style={{ fontSize: 11, color: "#80767a" }}>
            {team
              ? "Notificación de tu salón. Inicia sesión para consultar la agenda de"
              : "Este enlace es privado. Recibes este mensaje porque reservaste una cita en"}{" "}
            {salon}.
          </Text>
          <Text style={{ fontSize: 11, color: "#6c6267" }}>
            GlowBook · Desarrollado por{" "}
            <Link
              href={new URL(developer.href, url).href}
              style={{ color: "#754c60" }}
            >
              {developer.name}
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
