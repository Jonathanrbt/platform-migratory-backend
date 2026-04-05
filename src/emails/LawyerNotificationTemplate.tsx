import { Html, Head, Body, Text, Section, Link, Preview, Container, Row, Column } from '@react-email/components';
import * as React from 'react';

interface Props {
  title: string;
  clientName: string;
  color: string;
  iconType: 'document' | 'update' | 'alert' | 'pending';
  message: string;
  actionUrl: string;
}

const IconMapper = ({ type, color }: { type: string, color: string }) => {
  switch(type) {
    case 'document':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
    case 'update':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 1.94-11.83l-3.23 3.23"></path>
        </svg>
      );
    case 'alert':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      );
  }
};

export default function LawyerNotificationTemplate({ title, clientName, color, iconType, message, actionUrl }: Props) {
  const badgeColor = color || '#18181B';
  const bgColor = badgeColor + '0A';

  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@300;400;500;600&display=swap');
          `}
        </style>
      </Head>
      <Preview>Actualización en el expediente de {clientName}</Preview>
      <Body style={{ fontFamily: '"Outfit", "Helvetica Neue", Helvetica, sans-serif', backgroundColor: '#FFFFFF', margin: 0, padding: 0 }}>
        <Container style={{ backgroundColor: '#FFFFFF', margin: '0 auto', padding: '0', maxWidth: '100%', overflow: 'hidden' }}>
          
          <Section style={{ backgroundColor: '#09090B', padding: '32px 40px', borderBottom: '1px solid #27272A' }}>
            <Text style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '24px', color: '#FFFFFF', margin: 0, fontWeight: '600', letterSpacing: '0.5px' }}>
              Portal Administrativo
            </Text>
            <Text style={{ fontSize: '13px', color: '#A1A1AA', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Notificación Interna
            </Text>
          </Section>
          
          <Section style={{ padding: '40px 40px 20px' }}>
            <Text style={{ fontSize: '16px', color: '#3F3F46', margin: '0 0 24px', fontWeight: '400', lineHeight: '24px' }}>
              Estimado Equipo Legal,
            </Text>
            
            <Text style={{ fontSize: '16px', color: '#52525B', lineHeight: '28px', margin: '0 0 36px', fontWeight: '300' }}>
              Se ha registrado un nuevo evento en el expediente correspondiente a <strong style={{ color: '#18181B', fontWeight: '500' }}>{clientName}</strong>:
            </Text>
            
            <Section style={{ margin: '0 0 36px', border: `1px solid ${badgeColor}30`, backgroundColor: bgColor, padding: '24px 32px', borderLeft: `4px solid ${badgeColor}` }}>
              <Row>
                <Column style={{ width: '40px' }}>
                  <IconMapper type={iconType} color={badgeColor} />
                </Column>
                <Column>
                  <Text style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '22px', color: badgeColor, margin: 0, fontWeight: '600' }}>
                    {title}
                  </Text>
                </Column>
              </Row>
            </Section>

            {message && (
              <Section style={{ margin: '0 0 36px', paddingLeft: '20px', borderLeft: '1px solid #E4E4E7' }}>
                <Text style={{ margin: 0, fontSize: '15px', color: '#52525B', lineHeight: '28px', fontWeight: '300', whiteSpace: 'pre-wrap' }}>{message}</Text>
              </Section>
            )}

            <Section style={{ margin: '40px 0 32px' }}>
              <Link href={actionUrl} style={{ 
                display: 'inline-block', 
                backgroundColor: '#09090B', 
                color: '#FFFFFF', 
                padding: '16px 36px', 
                textDecoration: 'none', 
                fontWeight: '500', 
                fontSize: '15px',
                letterSpacing: '0.5px'
              }}>
                Acceder al Panel
              </Link>
            </Section>
          </Section>

          <Section style={{ padding: '24px 40px', backgroundColor: '#FAFAFA', borderTop: '1px solid #E4E4E7' }}>
            <Text style={{ fontSize: '12px', color: '#A1A1AA', lineHeight: '20px', margin: 0, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Uso exclusivo interno • No divulgar
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
