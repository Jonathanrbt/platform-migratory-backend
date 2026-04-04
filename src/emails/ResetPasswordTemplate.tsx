import { Html, Head, Body, Text, Section, Preview, Container } from '@react-email/components';
import * as React from 'react';

interface Props {
  validationCode: string;
}

export default function ResetPasswordTemplate({ validationCode }: Props) {
  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@300;400;500;600&display=swap');
          `}
        </style>
      </Head>
      <Preview>Código de acceso para su cuenta</Preview>
      <Body style={{ fontFamily: '"Outfit", "Helvetica Neue", Helvetica, sans-serif', backgroundColor: '#FFFFFF', margin: 0, padding: 0 }}>
        <Container style={{ backgroundColor: '#FFFFFF', margin: '0 auto', padding: '0', maxWidth: '100%', overflow: 'hidden' }}>
          
          <Section style={{ backgroundColor: '#18181B', padding: '40px 40px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px' }}>
              <path d="M20 0L40 20L20 40L0 20L20 0Z" fill="#E4E4E7" fillOpacity="0.1"/>
              <path d="M20 8L32 20L20 32L8 20L20 8Z" stroke="#E4E4E7" strokeWidth="2"/>
              <circle cx="20" cy="20" r="4" fill="#E4E4E7"/>
            </svg>
            <Text style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '28px', color: '#FFFFFF', margin: 0, fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Sistema Migratorio
            </Text>
          </Section>
          
          <Section style={{ padding: '40px 40px 20px' }}>
            <Text style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '26px', color: '#18181B', margin: '0 0 24px', fontWeight: '700' }}>
              Restablecimiento de Acceso
            </Text>

            <Text style={{ fontSize: '16px', color: '#3F3F46', margin: '0 0 24px', fontWeight: '400', lineHeight: '24px' }}>
              Estimado usuario,
            </Text>
            
            <Text style={{ fontSize: '16px', color: '#52525B', lineHeight: '28px', margin: '0 0 36px', fontWeight: '300' }}>
              Se ha solicitado un restablecimiento de contraseña para su cuenta. Para continuar con el proceso de forma segura, utilice el siguiente código de autorización:
            </Text>
            
            <Section style={{ margin: '0 0 36px', border: '1px solid #E4E4E7', backgroundColor: '#FAFAFA', padding: '32px', textAlign: 'center' }}>
              <Text style={{ 
                fontFamily: '"Outfit", sans-serif',
                fontSize: '42px', 
                fontWeight: '400', 
                letterSpacing: '12px', 
                color: '#18181B', 
                margin: '0',
                paddingLeft: '12px'
              }}>
                {validationCode}
              </Text>
            </Section>

            <Text style={{ fontSize: '14px', color: '#71717A', lineHeight: '24px', margin: '0 0 32px', fontWeight: '300' }}>
              Por motivos de seguridad, este código expirará en <strong style={{ color: '#18181B', fontWeight: '500' }}>15 minutos</strong>. Si usted no ha emitido esta solicitud, le rogamos desestimar este mensaje.
            </Text>
          </Section>

          <Section style={{ padding: '24px 40px', backgroundColor: '#FAFAFA', borderTop: '1px solid #E4E4E7' }}>
            <Text style={{ fontSize: '12px', color: '#A1A1AA', lineHeight: '20px', margin: 0, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Comunicación automatizada • No responder a este correo
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
