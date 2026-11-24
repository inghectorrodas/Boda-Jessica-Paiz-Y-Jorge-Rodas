import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  buildSeatingPlan,
  formatWeddingEventDateLabel,
  formatWeddingReportDateLabel,
  getSurnameSortKey,
  getZoneInfo,
  GuestParty,
  GuestRelationGroup,
  INITIAL_GUEST_PARTIES,
  RsvpRecord,
} from '../data/weddingData';

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

export interface PdfWeddingMeta {
  weddingDateISO?: string;
  receptionVenue?: string;
}

export function exportWeddingReportPdf(
  rsvps: RsvpRecord[],
  totalTables: number = 10,
  weddingMeta?: PdfWeddingMeta
): void {
  const reportDateLabel = formatWeddingReportDateLabel(
    weddingMeta?.weddingDateISO
  );
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  }) as JsPDFWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const confirmed = rsvps.filter((r) => r.attending);
  const declined = rsvps.filter((r) => !r.attending);

  const totalAdults = confirmed.reduce((sum, r) => sum + r.adults, 0);
  const totalKids = confirmed.reduce((sum, r) => sum + r.kids, 0);
  const totalBabies = confirmed.reduce((sum, r) => sum + r.babies, 0);
  const totalBanquetSeats = totalAdults + totalKids;

  // --- Editorial Header Banner ---
  doc.setFillColor(44, 62, 53); // #2c3e35 forest
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setDrawColor(184, 151, 83); // #b89753 gold
  doc.setLineWidth(0.6);
  doc.line(14, 30, pageWidth - 14, 30);

  doc.setTextColor(184, 151, 83);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('REPORTE OFICIAL DE ASISTENCIA Y ORGANIZACION DE MESAS', 14, 11);

  doc.setTextColor(252, 251, 249);
  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.text('Boda Jessica Paiz & Jorge Rodas', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const generatedStr = new Date().toLocaleString('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(
    `${reportDateLabel}  |  Generado: ${generatedStr}`,
    14,
    26.5
  );

  // --- Section 1: Cantidad de Adultos, Niños y Bebés Confirmados ---
  doc.setTextColor(44, 62, 53);
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.text('1. Resumen de Asistencia Confirmada', 14, 44);

  autoTable(doc, {
    startY: 47,
    head: [
      [
        'Familias Confirmadas',
        'Adultos',
        'Ninos (Asiento)',
        'Bebes (Regazo)',
        'Total Asientos Banquete',
        'No Asisten',
      ],
    ],
    body: [
      [
        String(confirmed.length),
        String(totalAdults),
        String(totalKids),
        String(totalBabies),
        String(totalBanquetSeats),
        String(declined.length),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [44, 62, 53],
      textColor: [252, 251, 249],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    bodyStyles: {
      fillColor: [247, 245, 240],
      textColor: [44, 62, 53],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center',
    },
    styles: {
      lineColor: [184, 151, 83],
      lineWidth: 0.25,
      cellPadding: 3.5,
    },
    margin: { left: 14, right: 14 },
  });

  // --- Section 2: Listado de Invitados Confirmados y Mesa Asignada ---
  let nextY = (doc.lastAutoTable?.finalY ?? 70) + 10;
  doc.setTextColor(44, 62, 53);
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.text('2. Listado de Invitados Confirmados y Mesa Asignada', 14, nextY);

  const confirmedRows = confirmed.map((r, idx) => {
    const zone =
      r.tableNumber > 0 ? getZoneInfo(r.tableNumber).zoneLabel : 'Sin asignar';
    const contactNotes = [r.phone, r.notes].filter(Boolean).join(' · ') || '—';
    return [
      String(idx + 1),
      r.guestName,
      String(r.adults),
      String(r.kids),
      String(r.babies),
      String(r.adults + r.kids),
      r.tableNumber > 0 ? `Mesa #${r.tableNumber}` : '—',
      zone,
      contactNotes,
    ];
  });

  if (confirmedRows.length === 0) {
    confirmedRows.push([
      '—',
      'Sin confirmaciones registradas aún en línea',
      '0',
      '0',
      '0',
      '0',
      '—',
      '—',
      '—',
    ]);
  }

  autoTable(doc, {
    startY: nextY + 3,
    head: [
      [
        '#',
        'Invitado / Familia',
        'Ad.',
        'Niñ.',
        'Bb.',
        'Asientos',
        'Mesa',
        'Ubicación Salón',
        'Contacto / Notas',
      ],
    ],
    body: confirmedRows,
    theme: 'striped',
    headStyles: {
      fillColor: [44, 62, 53],
      textColor: [252, 251, 249],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      textColor: [44, 62, 53],
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [252, 251, 249],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 30 },
    },
    styles: {
      lineColor: [220, 210, 188],
      lineWidth: 0.2,
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    margin: { left: 14, right: 14 },
  });

  // --- Section 3: Distribución Completa por Mesas de 10 ---
  nextY = (doc.lastAutoTable?.finalY ?? 130) + 10;
  if (nextY > 235) {
    doc.addPage();
    nextY = 18;
  }

  doc.setTextColor(44, 62, 53);
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.text('3. Distribucion del Salon por Mesa (Mesas de 10)', 14, nextY);

  const liveParties: GuestParty[] = confirmed.map((r) => ({
    id: r.id,
    name: r.guestName,
    surnames: r.surnames,
    adults: r.adults,
    kids: r.kids,
    babies: r.babies,
    tableNumber: r.tableNumber > 0 ? r.tableNumber : 1,
    isUserSubmitted: true,
  }));

  const fullTables = buildSeatingPlan(
    [...INITIAL_GUEST_PARTIES, ...liveParties],
    totalTables
  );

  const tableSummaryRows = fullTables.map((table) => {
    const familiesText =
      table.parties.length > 0
        ? table.parties
            .map(
              (p) =>
                `${p.name} (${p.adults + p.kids}${p.babies > 0 ? `+${p.babies}bb` : ''})`
            )
            .join(', ')
        : 'Disponible';
    return [
      `Mesa #${table.tableNumber}`,
      table.zoneLabel,
      `${table.occupiedSeats} / ${table.capacity}`,
      familiesText,
    ];
  });

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Mesa', 'Zona en el Salón', 'Ocupación', 'Familias Agrupadas']],
    body: tableSummaryRows,
    theme: 'striped',
    headStyles: {
      fillColor: [184, 151, 83],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [44, 62, 53],
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 38 },
      2: { cellWidth: 22, halign: 'center' },
    },
    styles: {
      lineColor: [220, 210, 188],
      lineWidth: 0.2,
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    margin: { left: 14, right: 14 },
  });

  // --- Section 4: Invitados que Declinaron (si aplica) ---
  if (declined.length > 0) {
    nextY = (doc.lastAutoTable?.finalY ?? 190) + 10;
    if (nextY > 240) {
      doc.addPage();
      nextY = 18;
    }

    doc.setTextColor(44, 62, 53);
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text('4. Invitados que No Podran Asistir', 14, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      head: [['Invitado / Familia', 'Teléfono', 'Mensaje / Motivo']],
      body: declined.map((d) => [
        d.guestName,
        d.phone || '—',
        d.notes || '—',
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [110, 68, 72],
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      bodyStyles: {
        textColor: [44, 62, 53],
        fontSize: 8,
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Page footer numbering
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Jessica Paiz & Jorge Rodas · ${reportDateLabel}  —  Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save('Reporte_Invitados_Boda_Jessica_y_Jorge.pdf');
}

export function exportTablePlaceCardsPdf(
  rsvps: RsvpRecord[],
  totalTables: number = 10,
  weddingMeta?: PdfWeddingMeta
): void {
  const reportDateLabel = formatWeddingReportDateLabel(
    weddingMeta?.weddingDateISO
  );
  const fullEventDateLabel = formatWeddingEventDateLabel(
    weddingMeta?.weddingDateISO
  );
  const safeVenue =
    weddingMeta?.receptionVenue?.trim() || 'Salón de Eventos Elegance';
  const safeTotalTables = Math.max(1, Math.min(50, totalTables));
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  }) as JsPDFWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const confirmed = rsvps.filter((r) => r.attending);

  for (let tableNum = 1; tableNum <= safeTotalTables; tableNum++) {
    if (tableNum > 1) {
      doc.addPage();
    }

    const { zoneLabel, proximityNote } = getZoneInfo(tableNum);
    const tableRsvps = confirmed.filter((r) => r.tableNumber === tableNum);

    // Build the 10 seats array
    interface SeatItem {
      seatNumber: number;
      guestLabel: string;
      category: string;
      status: 'Confirmado' | 'Disponible';
    }

    const seats: SeatItem[] = [];
    let currentSeat = 1;
    const babyNotes: string[] = [];

    for (const rsvp of tableRsvps) {
      if (rsvp.babies > 0) {
        babyNotes.push(
          `${rsvp.guestName} (${rsvp.babies} bebé${rsvp.babies > 1 ? 's' : ''} en regazo)`
        );
      }

      // Adults
      for (let i = 0; i < rsvp.adults; i++) {
        if (currentSeat <= 10) {
          seats.push({
            seatNumber: currentSeat,
            guestLabel: rsvp.guestName,
            category: 'Adulto',
            status: 'Confirmado',
          });
          currentSeat++;
        }
      }

      // Kids
      for (let i = 0; i < rsvp.kids; i++) {
        if (currentSeat <= 10) {
          seats.push({
            seatNumber: currentSeat,
            guestLabel: `${rsvp.guestName} (Niño/a)`,
            category: 'Menor con Asiento',
            status: 'Confirmado',
          });
          currentSeat++;
        }
      }
    }

    // Unassigned remaining seats up to 10
    while (currentSeat <= 10) {
      seats.push({
        seatNumber: currentSeat,
        guestLabel: '— Asiento Libre —',
        category: 'Sin asignar',
        status: 'Disponible',
      });
      currentSeat++;
    }

    const occupiedCount = seats.filter((s) => s.status === 'Confirmado').length;

    // --- Outer & Inner Gold Frames ---
    doc.setDrawColor(184, 151, 83); // #b89753
    doc.setLineWidth(0.8);
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

    doc.setLineWidth(0.25);
    doc.rect(12.5, 12.5, pageWidth - 25, pageHeight - 25);

    // Corner decorative accents
    doc.setLineWidth(0.5);
    const cornerSize = 4.5;
    // Top-left
    doc.line(12.5, 12.5 + cornerSize, 12.5 + cornerSize, 12.5);
    // Top-right
    doc.line(
      pageWidth - 12.5 - cornerSize,
      12.5,
      pageWidth - 12.5,
      12.5 + cornerSize
    );
    // Bottom-left
    doc.line(
      12.5,
      pageHeight - 12.5 - cornerSize,
      12.5 + cornerSize,
      pageHeight - 12.5
    );
    // Bottom-right
    doc.line(
      pageWidth - 12.5 - cornerSize,
      pageHeight - 12.5,
      pageWidth - 12.5,
      pageHeight - 12.5 - cornerSize
    );

    // --- Top Editorial Header Banner ---
    doc.setFillColor(20, 29, 24); // #141d18 dark forest
    doc.rect(13, 13, pageWidth - 26, 36, 'F');

    doc.setTextColor(184, 151, 83);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'ARTE OFICIAL DE BANQUETE · LISTADO DE ASIENTOS POR MESA',
      pageWidth / 2,
      21.5,
      { align: 'center' }
    );

    doc.setTextColor(252, 251, 249);
    doc.setFont('times', 'bold');
    doc.setFontSize(18.5);
    doc.text('Jessica Paiz & Jorge Rodas', pageWidth / 2, 30.5, {
      align: 'center',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(215, 200, 168);
    doc.text(
      `${fullEventDateLabel} · ${safeVenue} · San Salvador`,
      pageWidth / 2,
      38.5,
      { align: 'center' }
    );

    // --- Table Identification Card ---
    doc.setFillColor(247, 245, 240);
    doc.roundedRect(18, 54, pageWidth - 36, 31, 2.5, 2.5, 'F');
    doc.setDrawColor(184, 151, 83);
    doc.setLineWidth(0.4);
    doc.roundedRect(18, 54, pageWidth - 36, 31, 2.5, 2.5, 'D');

    doc.setTextColor(44, 62, 53);
    doc.setFont('times', 'bold');
    doc.setFontSize(27);
    doc.text(`MESA #${tableNum}`, pageWidth / 2, 66.5, { align: 'center' });

    doc.setTextColor(184, 151, 83);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(zoneLabel.toUpperCase(), pageWidth / 2, 73.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(85, 85, 85);
    doc.text(proximityNote, pageWidth / 2, 79.5, { align: 'center' });

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(44, 62, 53);
    doc.text(
      `DISTRIBUCIÓN DE ASIENTOS (1 AL 10) · ${occupiedCount} DE 10 OCUPADOS`,
      18,
      94
    );

    // AutoTable: 10 Seats
    const tableData = seats.map((s) => [
      `Asiento ${s.seatNumber}`,
      s.guestLabel,
      s.category,
      s.status === 'Confirmado' ? 'CONFIRMADO' : 'DISPONIBLE',
    ]);

    autoTable(doc, {
      startY: 97,
      head: [
        [
          'Número de Asiento',
          'Nombre de Invitado / Familia Asignada',
          'Tipo de Lugar',
          'Estado',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [44, 62, 53],
        textColor: [252, 251, 249],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: {
        textColor: [44, 62, 53],
        fontSize: 8.8,
        cellPadding: 3.5,
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowData = seats[data.row.index];
          if (rowData && rowData.status === 'Disponible') {
            data.cell.styles.textColor = [155, 155, 155];
            data.cell.styles.fontStyle = 'normal';
          } else if (data.column.index === 3) {
            data.cell.styles.textColor = [35, 125, 65]; // emerald green
          }
        }
      },
      styles: {
        lineColor: [215, 200, 168],
        lineWidth: 0.25,
      },
      alternateRowStyles: {
        fillColor: [252, 251, 249],
      },
      margin: { left: 18, right: 18 },
    });

    const finalY = (doc.lastAutoTable?.finalY ?? 190) + 7;

    // Optional Babies note
    if (babyNotes.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(184, 151, 83);
      doc.text(
        `* Asistencia de bebés en regazo en esta mesa: ${babyNotes.join(' · ')}`,
        18,
        finalY
      );
    }

    // Footer information for printing & display
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(
      'Documento imprimible para exhibir en portaretratos de mesa, atriles o listados del banquete de bodas.',
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(184, 151, 83);
    doc.text(
      `Mesa ${tableNum} de ${safeTotalTables} · Jessica Paiz & Jorge Rodas · ${reportDateLabel}`,
      pageWidth / 2,
      pageHeight - 16,
      { align: 'center' }
    );
  }

  doc.save('Carteles_Mesas_Boda_Jessica_y_Jorge.pdf');
}

interface SeatAssignmentRange {
  startSeat: number;
  endSeat: number;
  seatCount: number;
}

function computeConfirmedSeatRanges(
  confirmed: RsvpRecord[]
): Map<string, SeatAssignmentRange> {
  const ranges = new Map<string, SeatAssignmentRange>();
  const byTable = new Map<number, RsvpRecord[]>();

  for (const rsvp of confirmed) {
    if (rsvp.tableNumber <= 0) continue;
    const list = byTable.get(rsvp.tableNumber) ?? [];
    list.push(rsvp);
    byTable.set(rsvp.tableNumber, list);
  }

  for (const [, tableRsvps] of byTable) {
    let currentSeat = 1;
    for (const rsvp of tableRsvps) {
      const seatCount = Math.max(1, rsvp.adults + rsvp.kids);
      const startSeat = currentSeat;
      const endSeat = currentSeat + seatCount - 1;
      ranges.set(rsvp.id, { startSeat, endSeat, seatCount });
      currentSeat += seatCount;
    }
  }

  return ranges;
}

export function exportConfirmedGuestsBySurnamePdf(
  rsvps: RsvpRecord[],
  weddingMeta?: PdfWeddingMeta
): void {
  const reportDateLabel = formatWeddingReportDateLabel(
    weddingMeta?.weddingDateISO
  );
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  }) as JsPDFWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const confirmed = rsvps.filter((r) => r.attending);
  const seatRanges = computeConfirmedSeatRanges(confirmed);

  // --- Editorial Header Banner ---
  doc.setFillColor(44, 62, 53); // #2c3e35
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setDrawColor(184, 151, 83); // #b89753
  doc.setLineWidth(0.6);
  doc.line(14, 30, pageWidth - 14, 30);

  doc.setTextColor(184, 151, 83);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    'DIRECTORIO DE INVITADOS CONFIRMADOS · ORDENADO POR APELLIDOS',
    14,
    11
  );

  doc.setTextColor(252, 251, 249);
  doc.setFont('times', 'bold');
  doc.setFontSize(18.5);
  doc.text('Boda Jessica Paiz & Jorge Rodas', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  const generatedStr = new Date().toLocaleString('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(
    `${reportDateLabel}  |  Division por Familia y Amigos  |  Generado: ${generatedStr}`,
    14,
    26.5
  );

  // --- Group confirmed guests into the 4 requested divisions (+ unclassified fallback) ---
  const divisions: Array<{
    key: GuestRelationGroup | 'unclassified';
    title: string;
    accentColor: [number, number, number];
    items: RsvpRecord[];
  }> = [
    {
      key: 'familiar_novio',
      title: 'Familiar del Novio',
      accentColor: [44, 62, 53],
      items: [],
    },
    {
      key: 'familiar_novia',
      title: 'Familiar de la Novia',
      accentColor: [148, 114, 48],
      items: [],
    },
    {
      key: 'amigo_novia',
      title: 'Amigo de la Novia',
      accentColor: [110, 74, 82],
      items: [],
    },
    {
      key: 'amigo_novio',
      title: 'Amigo del Novio',
      accentColor: [56, 82, 98],
      items: [],
    },
  ];

  const unclassifiedItems: RsvpRecord[] = [];
  for (const rsvp of confirmed) {
    const foundDivision = divisions.find((d) => d.key === rsvp.guestGroup);
    if (foundDivision) {
      foundDivision.items.push(rsvp);
    } else {
      unclassifiedItems.push(rsvp);
    }
  }

  if (unclassifiedItems.length > 0) {
    divisions.push({
      key: 'unclassified',
      title: 'Sin Clasificar (Asignar Grupo en Panel)',
      accentColor: [105, 105, 105],
      items: unclassifiedItems,
    });
  }

  // Sort every division alphabetically by surnames
  for (const div of divisions) {
    div.items.sort((a, b) =>
      getSurnameSortKey(a.guestName).localeCompare(
        getSurnameSortKey(b.guestName),
        'es',
        { sensitivity: 'base' }
      )
    );
  }

  // --- Summary Table by Division ---
  doc.setTextColor(44, 62, 53);
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('Resumen por Division (Invitados Confirmados)', 14, 43);

  const summaryRows = divisions.map((div) => {
    const seats = div.items.reduce((sum, r) => sum + r.adults + r.kids, 0);
    const babies = div.items.reduce((sum, r) => sum + r.babies, 0);
    return [
      div.title,
      String(div.items.length),
      String(seats),
      String(babies),
    ];
  });

  const grandTotalSeats = confirmed.reduce(
    (sum, r) => sum + r.adults + r.kids,
    0
  );
  const grandTotalBabies = confirmed.reduce((sum, r) => sum + r.babies, 0);

  summaryRows.push([
    'TOTAL CONFIRMADOS',
    String(confirmed.length),
    String(grandTotalSeats),
    String(grandTotalBabies),
  ]);

  autoTable(doc, {
    startY: 46,
    head: [
      ['Division', 'Registros / Familias', 'Asientos (Banquete)', 'Bebes'],
    ],
    body: summaryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [44, 62, 53],
      textColor: [252, 251, 249],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [44, 62, 53],
      fontSize: 8.8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 38 },
      2: { halign: 'center', cellWidth: 38, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 24 },
    },
    didParseCell: (data) => {
      if (
        data.section === 'body' &&
        data.row.index === summaryRows.length - 1
      ) {
        data.cell.styles.fillColor = [247, 245, 240];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    styles: {
      lineColor: [184, 151, 83],
      lineWidth: 0.25,
    },
    margin: { left: 14, right: 14 },
  });

  let nextY = (doc.lastAutoTable?.finalY ?? 90) + 9;

  // --- Detailed Sections by Division (Sorted by Surname) ---
  divisions.forEach((div, divIndex) => {
    if (nextY > pageHeight - 42) {
      doc.addPage();
      nextY = 18;
    }

    const divSeats = div.items.reduce((sum, r) => sum + r.adults + r.kids, 0);

    doc.setFillColor(247, 245, 240);
    doc.roundedRect(14, nextY, pageWidth - 28, 9.5, 1.5, 1.5, 'F');
    doc.setDrawColor(184, 151, 83);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, nextY, pageWidth - 28, 9.5, 1.5, 1.5, 'D');

    doc.setTextColor(...div.accentColor);
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text(`${divIndex + 1}. ${div.title}`, 17.5, nextY + 6.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(120, 98, 52);
    doc.text(
      `${div.items.length} registro(s) · ${divSeats} asiento(s)`,
      pageWidth - 17.5,
      nextY + 6.3,
      { align: 'right' }
    );

    const rows =
      div.items.length > 0
        ? div.items.map((r, idx) => {
            const seatInfo = seatRanges.get(r.id);
            const seatText =
              r.tableNumber > 0 && seatInfo
                ? seatInfo.startSeat === seatInfo.endSeat
                  ? `Asiento #${seatInfo.startSeat}`
                  : `Asientos #${seatInfo.startSeat} - #${seatInfo.endSeat}`
                : 'Sin asignar';
            const tableText =
              r.tableNumber > 0
                ? `Mesa #${r.tableNumber}\n${getZoneInfo(r.tableNumber).zoneLabel}`
                : 'Sin asignar';
            const peopleBreakdown = [
              `${r.adults} ad`,
              r.kids > 0 ? `${r.kids} nin` : '',
              r.babies > 0 ? `${r.babies} bb` : '',
            ]
              .filter(Boolean)
              .join(' · ');

            return [
              String(idx + 1),
              r.guestName,
              peopleBreakdown,
              tableText,
              seatText,
              r.phone?.trim() || '—',
            ];
          })
        : [
            [
              '—',
              `Sin invitados confirmados en ${div.title.toLowerCase()}`,
              '—',
              '—',
              '—',
              '—',
            ],
          ];

    autoTable(doc, {
      startY: nextY + 11.5,
      head: [
        [
          '#',
          'Nombre (Ordenado por Apellidos)',
          'Lugares',
          'Mesa Asignada',
          'Asiento(s)',
          'Telefono',
        ],
      ],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: div.accentColor,
        textColor: [252, 251, 249],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        textColor: [44, 62, 53],
        fontSize: 8.2,
      },
      alternateRowStyles: {
        fillColor: [252, 251, 249],
      },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 33, halign: 'center' },
        4: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 30, halign: 'center' },
      },
      styles: {
        lineColor: [220, 210, 188],
        lineWidth: 0.2,
        cellPadding: 2.5,
        overflow: 'linebreak',
      },
      margin: { left: 14, right: 14 },
    });

    nextY = (doc.lastAutoTable?.finalY ?? nextY + 25) + 9;
  });

  // Page footer numbering
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Directorio por Apellidos (Familia y Amigos) · Boda Jessica & Jorge  —  Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save('Reporte_Confirmados_Por_Apellidos_Boda_Jessica_y_Jorge.pdf');
}
