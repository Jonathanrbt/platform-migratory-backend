import { Html, Head, Body, Text, Section, Link, Preview, Container, Row, Column } from '@react-email/components';
import * as React from 'react';

interface Props {
  clientName: string;
  statusText: string;
  color: string;
  iconType: 'success' | 'error' | 'warning' | 'pending' | 'document';
  customMessage: string;
  actionUrl: string;
}

const IconMapper = ({ type, color }: { type: string, color: string }) => {
  switch(type) {
    case 'success':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      );
    case 'error':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
    case 'warning':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    case 'document':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
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

export default function StatusUpdateTemplate({ clientName, statusText, color, iconType, customMessage, actionUrl }: Props) {
  const badgeColor = color || '#18181B';
  const bgColor = badgeColor + '0A'; // Very subtle background

  return (
    <Html>
      <Head>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@300;400;500;600&display=swap');
          `}
        </style>
      </Head>
      <Preview>Actualización sobre su expediente</Preview>
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
            <Text style={{ fontSize: '16px', color: '#3F3F46', margin: '0 0 24px', fontWeight: '400', lineHeight: '24px' }}>
              Estimado/a <span style={{ fontWeight: '600', color: '#18181B' }}>{clientName}</span>,
            </Text>
            
            <Text style={{ fontSize: '16px', color: '#52525B', lineHeight: '28px', margin: '0 0 36px', fontWeight: '300' }}>
              Le notificamos que el estado de su expediente ha sido actualizado en nuestro registro. El estatus actual es el siguiente:
            </Text>
            
            <Section style={{ margin: '0 0 36px', border: `1px solid ${badgeColor}30`, backgroundColor: bgColor, padding: '24px 32px', borderLeft: `4px solid ${badgeColor}` }}>
              <Row>
                <Column style={{ width: '40px' }}>
                  <IconMapper type={iconType} color={badgeColor} />
                </Column>
                <Column>
                  <Text style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '24px', color: badgeColor, margin: 0, fontWeight: '600' }}>
                    {statusText}
                  </Text>
                </Column>
              </Row>
            </Section>

            {customMessage && (
              <Section style={{ margin: '0 0 36px', paddingLeft: '20px', borderLeft: '1px solid #E4E4E7' }}>
                <Text style={{ margin: 0, fontSize: '15px', color: '#52525B', lineHeight: '28px', fontWeight: '300', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: customMessage }} />
              </Section>
            )}

            <Section style={{ margin: '40px 0 32px' }}>
              <Link href={actionUrl} style={{ 
                display: 'inline-block', 
                backgroundColor: '#18181B', 
                color: '#FFFFFF', 
                padding: '16px 36px', 
                textDecoration: 'none', 
                fontWeight: '500', 
                fontSize: '15px',
                letterSpacing: '0.5px'
              }}>
                Consultar Expediente
              </Link>
            </Section>
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
