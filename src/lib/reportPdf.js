import { jsPDF } from 'jspdf';

function addParagraph(document, heading, content, cursor) {
  let y = cursor;
  if (y > 270) {
    document.addPage();
    y = 18;
  }
  document.setFont('helvetica', 'bold');
  document.setFontSize(12);
  const headingLines = document.splitTextToSize(heading, 180);
  document.text(headingLines, 15, y);
  y += headingLines.length * 6 + 2;

  document.setFont('helvetica', 'normal');
  document.setFontSize(10);
  const lines = document.splitTextToSize(content, 180);
  for (const line of lines) {
    if (y > 278) {
      document.addPage();
      y = 18;
    }
    document.text(line, 15, y);
    y += 5;
  }
  return y + 7;
}

export function downloadReportPdf(report, score) {
  const document = new jsPDF();
  let y = 20;
  document.setFont('helvetica', 'bold');
  document.setFontSize(20);
  document.text('DecisionLab — rapport personnalisé', 15, y);
  y += 9;
  document.setFont('helvetica', 'normal');
  document.setFontSize(10);
  document.text(`Score du parcours : ${score}%`, 15, y);
  y += 12;

  y = addParagraph(document, 'Synthèse', report.summary, y);
  for (const item of report.strengths) {
    y = addParagraph(document, `Point fort — ${item.title}`, item.detail, y);
  }
  for (const item of report.improvements) {
    y = addParagraph(document, `Axe de progression — ${item.title}`, item.detail, y);
  }
  y = addParagraph(document, 'Pistes pour progresser', report.nextSteps.map((step) => `- ${step}`).join('\n'), y);
  document.save('decisionlab-rapport-personnalise.pdf');
}
