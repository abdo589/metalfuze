import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { name?: string; link?: string }

const Email = ({ name, link }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>سجّل حضورك أو انصرافك بصورة سيلفي</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>METAL FUZE</Heading>
        <Text style={text}>{name ? `أهلًا ${name}،` : 'أهلًا،'}</Text>
        <Text style={text}>اضغط الزر من جوالك لتسجيل الحضور أو الانصراف — هيطلب منك صورة سيلفي وتحديد موقعك.</Text>
        {link && <Button href={link} style={button}>تسجيل الحضور والانصراف</Button>}
        <Text style={muted}>الرابط خاص بك، لا تشاركه مع أحد.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'رابط تسجيل الحضور — Metal Fuze',
  displayName: 'رابط تسجيل الحضور',
  previewData: { name: 'عبدالرحمن', link: 'https://example.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '480px' }
const h1 = { fontSize: '20px', color: '#1f2937' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.7' }
const muted = { fontSize: '12px', color: '#6b7280' }
const button = { backgroundColor: '#b45309', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '15px' }
