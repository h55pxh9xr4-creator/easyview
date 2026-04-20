import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { name, company, email, message } = await req.json();

    if (!name || !company || !email || !message) {
      return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Easy View 문의" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_TO || "kr_easyview@pwc.com",
      replyTo: email,
      subject: `[Easy View 문의] ${company} - ${name}`,
      text: `회사명: ${company}\n담당자: ${name}\n이메일: ${email}\n\n문의 내용:\n${message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #FD5108; padding: 16px 24px;">
            <h2 style="color: white; margin: 0; font-size: 18px;">Easy View 문의</h2>
          </div>
          <div style="padding: 24px; border: 1px solid #DFE3E6;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px 0; color: #A1A8B3; width: 80px;">회사명</td><td style="padding: 8px 0; font-weight: 600; color: #222C40;">${company}</td></tr>
              <tr><td style="padding: 8px 0; color: #A1A8B3;">담당자</td><td style="padding: 8px 0; font-weight: 600; color: #222C40;">${name}</td></tr>
              <tr><td style="padding: 8px 0; color: #A1A8B3;">이메일</td><td style="padding: 8px 0; color: #222C40;"><a href="mailto:${email}" style="color: #FD5108;">${email}</a></td></tr>
            </table>
            <hr style="border: none; border-top: 1px solid #DFE3E6; margin: 16px 0;" />
            <p style="color: #A1A8B3; font-size: 12px; margin: 0 0 8px;">문의 내용</p>
            <p style="color: #222C40; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("메일 전송 오류:", err);
    return NextResponse.json({ error: "메일 전송에 실패했습니다." }, { status: 500 });
  }
}
