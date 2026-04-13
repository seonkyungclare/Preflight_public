import pdfParse from 'pdf-parse'

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData()
  const file = formData.get('file')

  // 파일 유효성 검사
  if (!(file instanceof File)) {
    return Response.json({ error: 'file이 필요합니다' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await pdfParse(buffer)

    if (!result.text.trim()) {
      return Response.json({ error: 'PDF에서 텍스트를 추출하지 못했습니다' }, { status: 422 })
    }

    return Response.json({ text: result.text })
  } catch (error) {
    console.error('[parse-pdf] PDF 파싱 오류:', error)
    return Response.json({ error: 'PDF 파싱 중 오류가 발생했습니다' }, { status: 500 })
  }
}
