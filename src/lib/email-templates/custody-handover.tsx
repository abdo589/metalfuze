import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  employee?: string
  device?: string
  brand?: string
  model?: string
  serial?: string
  assetNo?: string
  specs?: string
  dept?: string
  date?: string
}

const Row = ({ label, value }: { label: string; value?: string | undefined }) =>
  value ? (
    <tr>
      <td style={cellLabel}>{label}</td>
      <td style={cellValue}>{value}</td>
    </tr>
  ) : null

const Email = ({ employee, device, brand, model, serial, assetNo, specs, dept, date }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تم تسليمك عهدة جهاز — تفاصيل الجهاز بالداخل</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>METAL FUZE</Heading>
        <Text style={text}>{employee ? `أهلًا ${employee}،` : 'أهلًا،'}</Text>
        <Text style={text}>تم تسجيل استلامك للجهاز التالي كعهدة شخصية تحت مسؤوليتك:</Text>
        <table style={table} cellPadding={0} cellSpacing={0}>
          <tbody>
            <Row label="الجهاز" value={device} />
            <Row label="الشركة المصنعة" value={brand} />
            <Row label="الموديل" value={model} />
            <Row label="الرقم التسلسلي" value={serial} />
            <Row label="رقم الأصل" value={assetNo} />
            <Row label="المواصفات" value={specs} />
            <Row label="القسم" value={dept} />
            <Row label="تاريخ التسليم" value={date} />
          </tbody>
        </table>
        <Text style={muted}>يُرجى الحفاظ على الجهاز وإبلاغ الإدارة فورًا في حال حدوث أي عطل أو فقدان.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'تم تسليمك عهدة جهاز — Metal Fuze',
  displayName: 'تسليم عهدة جهاز',
  previewData: { employee: 'محمد', device: 'لابتوب Dell', brand: 'Dell', model: 'Latitude 5520', serial: 'SN123', assetNo: 'MF-001', specs: '14 بوصة', dept: 'الهندسة', date: '2026-11-02' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Tahoma, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '480px' }
const h1 = { fontSize: '20px', color: '#1f2937' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.7' }
const muted = { fontSize: '12px', color: '#6b7280', lineHeight: '1.7' }
const table = { width: '100%', borderCollapse: 'collapse' as const, margin: '12px 0' }
const cellLabel = { fontSize: '13px', color: '#6b7280', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', width: '40%' }
const cellValue = { fontSize: '14px', color: '#111827', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }
