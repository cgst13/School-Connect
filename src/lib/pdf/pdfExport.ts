// @ts-ignore
import html2pdf from 'html2pdf.js'

export interface ExportPdfOptions {
  filename?: string
  elementOrQuery?: HTMLElement | string | null
}

/**
 * Direct PDF Export Utility
 * Renders the Official TERMCAT Form cleanly into a high-resolution 8.5" x 13" Landscape PDF file
 * and triggers an immediate browser file download.
 * Pre-formats tables, cells, list items, and metadata rows to guarantee ZERO text overlaps and ZERO collapsed rows.
 */
export async function exportToPdfDirect({
  filename = 'TERMCAT Official Form.pdf',
  elementOrQuery,
}: ExportPdfOptions = {}): Promise<boolean> {
  let wrapperContainer: HTMLElement | null = null

  try {
    let targetElement: HTMLElement | null = null

    if (typeof elementOrQuery === 'string') {
      targetElement = document.querySelector(elementOrQuery) as HTMLElement | null
    } else if (elementOrQuery instanceof HTMLElement) {
      targetElement = elementOrQuery
    } else {
      targetElement = document.querySelector('.official-termcat-print-area') as HTMLElement | null
    }

    if (!targetElement) {
      console.warn('PDF export failed: Target printable element not found')
      return false
    }

    // Create a temporary container attached at a fixed position so the browser renders layout metrics cleanly
    wrapperContainer = document.createElement('div')
    wrapperContainer.style.position = 'fixed'
    wrapperContainer.style.left = '0'
    wrapperContainer.style.top = '0'
    wrapperContainer.style.zIndex = '-99999'
    wrapperContainer.style.opacity = '0.01'
    wrapperContainer.style.pointerEvents = 'none'
    wrapperContainer.style.width = '1200px'
    wrapperContainer.style.backgroundColor = '#ffffff'
    wrapperContainer.style.color = '#000000'
    wrapperContainer.style.padding = '0'
    wrapperContainer.style.margin = '0'
    wrapperContainer.style.boxSizing = 'border-box'

    // Clone target element to isolate from screen DOM styles & scroll offsets
    const clone = targetElement.cloneNode(true) as HTMLElement
    clone.classList.add('pdf-export-mode')
    clone.classList.add('official-termcat-print-area')

    // Hide screen-only controls or buttons inside the clone
    clone.querySelectorAll('.no-print, button, input, select').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })

    // Force container sizing and font family
    clone.style.width = '100%'
    clone.style.maxWidth = '100%'
    clone.style.margin = '0'
    clone.style.padding = '0'
    clone.style.boxSizing = 'border-box'
    clone.style.backgroundColor = '#ffffff'
    clone.style.color = '#000000'
    clone.style.fontFamily = 'Arial, Helvetica, sans-serif'
    clone.style.display = 'flex'
    clone.style.flexDirection = 'column'
    clone.style.gap = '6px'

    // Reset outer card wrapper padding/border if cloned from outer template node
    if (clone.classList.contains('p-4') || clone.classList.contains('sm:p-6')) {
      clone.style.padding = '0'
      clone.style.border = 'none'
      clone.style.boxShadow = 'none'
    }

    // 1. Transform <ol> list items into plain <div> text blocks to eliminate floating list number overlap
    clone.querySelectorAll('ol').forEach(ol => {
      const parent = ol.parentNode
      if (!parent) return
      const listWrapper = document.createElement('div')
      listWrapper.style.display = 'flex'
      listWrapper.style.flexDirection = 'column'
      listWrapper.style.gap = '2px'

      const listItems = Array.from(ol.querySelectorAll('li'))
      listItems.forEach((li, idx) => {
        const itemDiv = document.createElement('div')
        itemDiv.style.fontSize = '8.5px'
        itemDiv.style.lineHeight = '1.2'
        itemDiv.style.color = '#000000'
        itemDiv.style.whiteSpace = 'pre-wrap'
        itemDiv.style.wordBreak = 'break-word'
        itemDiv.style.overflowWrap = 'break-word'

        // Add explicit inline bold number
        itemDiv.innerHTML = `<span style="font-weight:bold; color:#000000;">${idx + 1}. </span>${li.innerHTML}`
        listWrapper.appendChild(itemDiv)
      })
      parent.replaceChild(listWrapper, ol)
    })

    // 2. Title Header Styling
    const titleEl = clone.querySelector('.border-b-2, h1, .text-center.font-bold') as HTMLElement | null
    if (titleEl) {
      titleEl.style.fontSize = '12px'
      titleEl.style.fontWeight = 'bold'
      titleEl.style.textAlign = 'center'
      titleEl.style.textTransform = 'uppercase'
      titleEl.style.paddingBottom = '2px'
      titleEl.style.borderBottom = '1.5px solid #000000'
      titleEl.style.marginBottom = '4px'
      titleEl.style.letterSpacing = '-0.01em'
    }

    // 3. Instructions Box Styling
    const instructionsEl = clone.querySelector('.bg-slate-50, .border-black') as HTMLElement | null
    if (instructionsEl) {
      instructionsEl.style.fontSize = '8.5px'
      instructionsEl.style.lineHeight = '1.25'
      instructionsEl.style.padding = '4px 6px'
      instructionsEl.style.border = '1px solid #000000'
      instructionsEl.style.backgroundColor = '#ffffff'
      instructionsEl.style.color = '#000000'
      instructionsEl.style.marginBottom = '4px'
    }

    // 3. Format Metadata Table (SDO Name, EPS Name, Learning Area, Term, School Year)
    const allTables = Array.from(clone.querySelectorAll('table'))
    if (allTables.length > 0) {
      const metaTable = allTables[0]
      if (metaTable.querySelectorAll('tbody tr').length <= 5) {
        metaTable.style.width = '1200px'
        metaTable.style.tableLayout = 'fixed'
        metaTable.style.borderCollapse = 'collapse'
        metaTable.style.border = '1.5px solid #000000'
        metaTable.style.marginBottom = '6px'

        metaTable.querySelectorAll('tr').forEach(tr => {
          const row = tr as HTMLElement
          // CRITICAL FIX: Clear background color from <tr> to prevent html2canvas 0px row height collapse!
          row.style.backgroundColor = 'transparent'
        })

        metaTable.querySelectorAll('td').forEach((td, idx) => {
          const cell = td as HTMLElement
          cell.style.border = '1px solid #000000'
          cell.style.padding = '3px 6px'
          cell.style.fontSize = '9px'
          cell.style.lineHeight = '1.2'
          cell.style.boxSizing = 'border-box'
          cell.style.verticalAlign = 'middle'
          cell.style.backgroundColor = '#deebf7'
          cell.style.color = '#000000'
          if (idx % 2 === 0) {
            cell.style.width = '150px'
            cell.style.fontWeight = 'bold'
          } else {
            cell.style.width = '1050px'
            cell.style.fontWeight = 'semibold'
          }
        })
      }
    }

    // 4. Format Main Data Tables (KS1 and KS2-4 tables)
    allTables.forEach((table, index) => {
      const isMainTable = index > 0 || allTables.length === 1
      if (!isMainTable) return

      const el = table as HTMLElement
      el.style.width = '1200px'
      el.style.maxWidth = '1200px'
      el.style.tableLayout = 'fixed'
      el.style.borderCollapse = 'collapse'
      el.style.border = '1.5px solid #000000'
      el.style.marginBottom = '6px'

      // CRITICAL FIX: Clear background colors on all <tr> to prevent html2canvas row stacking!
      table.querySelectorAll('tr').forEach(tr => {
        const row = tr as HTMLElement
        row.style.backgroundColor = 'transparent'
      })

      // Standardize table headers
      const ths = Array.from(table.querySelectorAll('th'))
      const isKS1 = ths.some(th => th.textContent?.includes('Key Stage 1'))

      ths.forEach(th => {
        const cell = th as HTMLElement
        cell.style.border = '1px solid #000000'
        cell.style.padding = '3px 2px'
        cell.style.fontSize = '8px'
        cell.style.lineHeight = '1.15'
        cell.style.fontWeight = 'bold'
        cell.style.textAlign = 'center'
        cell.style.verticalAlign = 'middle'
        cell.style.wordBreak = 'break-word'
        cell.style.overflowWrap = 'break-word'
        cell.style.color = '#000000'
      })

      // Standardize table cells
      table.querySelectorAll('td').forEach(td => {
        const cell = td as HTMLElement
        cell.style.border = '1px solid #000000'
        cell.style.padding = '3px 3px'
        cell.style.fontSize = '8px'
        cell.style.lineHeight = '1.2'
        cell.style.verticalAlign = 'top'
        cell.style.wordBreak = 'break-word'
        cell.style.overflowWrap = 'break-word'
        cell.style.whiteSpace = 'normal'
        cell.style.color = '#000000'
      })

      // Set explicit pixel widths for columns
      if (isKS1) {
        // 15 Columns: [66, 66, 60, 60, 60, 60, 60, 54, 54, 54, 78, 132, 132, 132, 132]
        const ks1Widths = [66, 66, 60, 60, 60, 60, 60, 54, 54, 54, 78, 132, 132, 132, 132]
        const firstRowCells = table.querySelector('tr')?.children
        if (firstRowCells) {
          Array.from(firstRowCells).forEach((cell, i) => {
            if (i < ks1Widths.length) {
              ;(cell as HTMLElement).style.width = `${ks1Widths[i]}px`
            }
          })
        }
      } else {
        // 11 Columns: [72, 60, 60, 54, 48, 48, 90, 198, 198, 198, 198]
        const ks24Widths = [72, 60, 60, 54, 48, 48, 90, 198, 198, 198, 198]
        const firstRowCells = table.querySelector('tr')?.children
        if (firstRowCells) {
          Array.from(firstRowCells).forEach((cell, i) => {
            if (i < ks24Widths.length) {
              ;(cell as HTMLElement).style.width = `${ks24Widths[i]}px`
            }
          })
        }
      }
    })

    // 5. Transform <ol> list items into plain text paragraphs to avoid marker overlap
    clone.querySelectorAll('ol').forEach(ol => {
      const parent = ol.parentNode
      if (!parent) return
      const listWrapper = document.createElement('div')
      listWrapper.style.display = 'flex'
      listWrapper.style.flexDirection = 'column'
      listWrapper.style.gap = '2px'

      const listItems = Array.from(ol.querySelectorAll('li'))
      listItems.forEach((li, idx) => {
        const itemDiv = document.createElement('div')
        itemDiv.style.fontSize = '8px'
        itemDiv.style.lineHeight = '1.2'
        itemDiv.style.color = '#000000'
        itemDiv.style.whiteSpace = 'normal'
        itemDiv.style.wordBreak = 'break-word'
        itemDiv.style.overflowWrap = 'break-word'
        itemDiv.innerHTML = `<span style="font-weight:bold;">${idx + 1}. </span>${li.innerHTML}`
        listWrapper.appendChild(itemDiv)
      })
      parent.replaceChild(listWrapper, ol)
    })

    // 7. Signatures Section Styling
    const sigSection = clone.querySelector('.grid-cols-3') as HTMLElement | null
    if (sigSection) {
      sigSection.style.display = 'grid'
      sigSection.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))'
      sigSection.style.gap = '20px'
      sigSection.style.paddingTop = '10px'
      sigSection.style.fontSize = '9px'
      sigSection.style.textAlign = 'center'

      sigSection.querySelectorAll('p').forEach(p => {
        const el = p as HTMLElement
        if (el.textContent?.includes('Prepared by:') || el.textContent?.includes('Checked:') || el.textContent?.includes('Approved by:')) {
          el.style.marginBottom = '18px'
        }
      })
    }

    wrapperContainer.appendChild(clone)
    document.body.appendChild(wrapperContainer)

    const options = {
      margin: [0.35, 0.4, 0.35, 0.4] as [number, number, number, number],
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      },
      jsPDF: {
        unit: 'in' as const,
        format: [13, 8.5] as [number, number],
        orientation: 'landscape' as const,
        compress: true,
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['tr', '.avoid-break', 'thead'],
      },
    }

    // Generate PDF blob and trigger immediate browser download
    await html2pdf().set(options).from(clone).save()
    return true
  } catch (error) {
    console.error('Error generating PDF file download:', error)
    return false
  } finally {
    if (wrapperContainer && wrapperContainer.parentNode) {
      wrapperContainer.parentNode.removeChild(wrapperContainer)
    }
  }
}
