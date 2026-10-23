import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { name?: string; action?: 'in' | 'out'; time?: string; photoUrl?: string; site?: string }

const Email = ({ name, action = 'in', time, photoUrl, site }: Props) => {
  const label = action === 'in' ? 'الحضور' : 'الانصراف'
  return (
    <Html lang="ar" dir="rtl">
      <Head />
      <Preview>{`تم تسجيل ${label} — صورتك مرفقة بالرابط`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>METAL FUZE</Heading>
          <Text style={text}>{name ? `أهلًا ${name}،` : 'أهلًا،'}</Text>
          <Text style={text}>تم تسجيل {label}{time ? ` الساعة ${time}` : ''}{site ? ` — ${site}` : ''}.</Text>
          {photoUrl && <Button href={photoUrl} style={button}>عرض صورة السيلفي</Button>}
          <Text style={muted}>الرابط صالح لمدة 7 أيام.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d) => (d.action === 'out' ? 'تم تسجيل الانصراف' : 'تم تسجيل الحضور') + ' — Metal Fuze',
  displayName: 'تأكيد الحضور مع السيلفي',
  previewData: { name: 'عبدالرحمن', action: 'in', time: '09:05', photoUrl: 'https://example.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '480px' }
const h1 = { fontSize: '20px', color: '#1f2937' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.7' }
const muted = { fontSize: '12px', color: '#6b7280' }
const button = { backgroundColor: '#b45309', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '15px' }
