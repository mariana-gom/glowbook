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
}: {
  salon: string;
  text: string;
  url: string;
}) {
  return (
    <Html lang="es">
      <Preview>{text.slice(0, 100)}</Preview>
      <Body style={{ background: "#faf7f4", fontFamily: "Arial" }}>
        <Container style={{ padding: 32 }}>
          <Heading style={{ color: "#754c60", fontFamily: "Georgia" }}>
            {salon}
          </Heading>
          <Text style={{ lineHeight: "26px" }}>{text}</Text>
          <Link href={url}>Gestionar mi cita y compartir mi experiencia</Link>
          <Text style={{ fontSize: 11, color: "#80767a" }}>
            Este enlace es privado. Recibes este mensaje porque reservaste una
            cita en {salon}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
