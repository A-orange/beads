/** 对齐编辑器显示用最大边长，避免 Safari 对大图做 CSS 缩放时内存崩溃 */
export const ALIGN_DISPLAY_MAX_EDGE = 2048

export interface AlignDisplaySize {
  w: number
  h: number
}

export function computeAlignDisplaySize(
  naturalW: number,
  naturalH: number,
  maxEdge = ALIGN_DISPLAY_MAX_EDGE,
): AlignDisplaySize {
  if (naturalW <= 0 || naturalH <= 0) return { w: 0, h: 0 }
  if (naturalW <= maxEdge && naturalH <= maxEdge) return { w: naturalW, h: naturalH }
  const ratio = maxEdge / Math.max(naturalW, naturalH)
  return {
    w: Math.round(naturalW * ratio),
    h: Math.round(naturalH * ratio),
  }
}

export interface AlignContentBounds {
  w: number
  h: number
}

export interface AlignDrawParams {
  image: CanvasImageSource | null
  imageDisplayW: number
  imageDisplayH: number
  imgOffsetX: number
  imgOffsetY: number
  imgScale: number
  gridOffsetX: number
  gridOffsetY: number
  gridScale: number
  rows: number
  cols: number
  cellWidth: number
  cellHeight: number
  gridColor: string
  showGrid: boolean
  viewportW: number
  viewportH: number
  viewportTx: number
  viewportTy: number
  viewportScale: number
}

export function getAlignContentBounds(params: {
  imageDisplayW: number
  imageDisplayH: number
  imgOffsetX: number
  imgOffsetY: number
  imgScale: number
  gridOffsetX: number
  gridOffsetY: number
  gridScale: number
  rows: number
  cols: number
  cellWidth: number
  cellHeight: number
  showGrid: boolean
}): AlignContentBounds {
  const imgW = params.imageDisplayW * params.imgScale
  const imgH = params.imageDisplayH * params.imgScale
  const imgRight = params.imgOffsetX + imgW
  const imgBottom = params.imgOffsetY + imgH

  let w = Math.max(imgRight, 1)
  let h = Math.max(imgBottom, 1)

  if (params.showGrid && params.rows > 0 && params.cols > 0) {
    const gridW = params.cols * params.cellWidth * params.gridScale
    const gridH = params.rows * params.cellHeight * params.gridScale
    w = Math.max(w, params.gridOffsetX + gridW)
    h = Math.max(h, params.gridOffsetY + gridH)
  }

  return { w, h }
}

export function drawAlignCanvas(ctx: CanvasRenderingContext2D, params: AlignDrawParams) {
  const { viewportW, viewportH } = params
  ctx.clearRect(0, 0, viewportW, viewportH)

  ctx.save()
  ctx.translate(params.viewportTx, params.viewportTy)
  ctx.scale(params.viewportScale, params.viewportScale)

  if (params.image && params.imageDisplayW > 0 && params.imageDisplayH > 0) {
    ctx.save()
    ctx.translate(params.imgOffsetX, params.imgOffsetY)
    ctx.scale(params.imgScale, params.imgScale)
    ctx.drawImage(params.image, 0, 0, params.imageDisplayW, params.imageDisplayH)
    ctx.restore()
  }

  if (
    params.showGrid &&
    params.rows > 0 &&
    params.cols > 0 &&
    params.cellWidth > 0 &&
    params.cellHeight > 0
  ) {
    const gridW = params.cols * params.cellWidth
    const gridH = params.rows * params.cellHeight

    ctx.save()
    ctx.translate(params.gridOffsetX, params.gridOffsetY)
    ctx.scale(params.gridScale, params.gridScale)

    ctx.strokeStyle = params.gridColor
    ctx.lineWidth = 1.2 / params.gridScale / params.viewportScale
    ctx.beginPath()

    for (let i = 1; i < params.cols; i++) {
      const x = i * params.cellWidth
      ctx.moveTo(x, 0)
      ctx.lineTo(x, gridH)
    }
    for (let i = 1; i < params.rows; i++) {
      const y = i * params.cellHeight
      ctx.moveTo(0, y)
      ctx.lineTo(gridW, y)
    }
    ctx.stroke()

    ctx.lineWidth = 1.8 / params.gridScale / params.viewportScale
    ctx.strokeRect(0, 0, gridW, gridH)

    ctx.restore()
  }

  ctx.restore()
}
