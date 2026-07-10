<script setup lang="ts">
import SdIcon from './SdIcon.vue'
import { ref, watch, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    variant?: 'default' | 'pixel'
    compact?: boolean
    /** 小数位数，0 表示整数 */
    decimals?: number
    /** 步进值，默认随 decimals 推导 */
    step?: number
  }>(),
  {
    min: 0,
    max: 9999,
    variant: 'pixel',
    compact: false,
    decimals: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const isFocused = ref(false)
const inputText = ref('')

const effectiveStep = computed(() => {
  if (props.step != null) return props.step
  return props.decimals > 0 ? 10 ** -props.decimals : 1
})

function roundToDecimals(value: number) {
  if (props.decimals <= 0) return Math.round(value)
  const factor = 10 ** props.decimals
  return Math.round(value * factor) / factor
}

function clamp(value: number) {
  return Math.min(props.max, Math.max(props.min, roundToDecimals(value)))
}

function stripTrailingZeros(text: string) {
  if (!text.includes('.')) return text
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** 输入过程中：不补零 */
function formatLoose(value: number) {
  if (value <= 0) return ''
  if (props.decimals <= 0) return String(Math.round(value))
  return stripTrailingZeros(roundToDecimals(value).toFixed(props.decimals))
}

/** 失焦后：补齐小数位 */
function formatStrict(value: number) {
  if (value <= 0) return ''
  if (props.decimals <= 0) return String(Math.round(value))
  return roundToDecimals(value).toFixed(props.decimals)
}

function syncDisplayFromModel() {
  inputText.value = formatLoose(props.modelValue)
}

watch(
  () => props.modelValue,
  () => {
    if (!isFocused.value) syncDisplayFromModel()
  },
)

syncDisplayFromModel()

function sanitizeDecimalText(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts[0]}.${parts.slice(1).join('').slice(0, props.decimals)}`
}

function parseInput(raw: string) {
  if (props.decimals > 0) {
    const normalized = sanitizeDecimalText(raw)
    if (!normalized || normalized === '.') return 0
    const val = parseFloat(normalized)
    return Number.isFinite(val) ? clamp(val) : 0
  }

  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return clamp(parseInt(digits, 10))
}

function onFocus(event: Event) {
  isFocused.value = true
  inputText.value = formatLoose(props.modelValue)
  const input = event.target as HTMLInputElement
  input.value = inputText.value
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const text = props.decimals > 0 ? sanitizeDecimalText(input.value) : input.value.replace(/\D/g, '')
  inputText.value = text
  input.value = text
  emit('update:modelValue', parseInput(text))
}

function onBlur(event: Event) {
  isFocused.value = false
  const input = event.target as HTMLInputElement
  input.value = formatStrict(props.modelValue)
  inputText.value = input.value
}

function increase() {
  const base = props.modelValue > 0 ? props.modelValue : 0
  const next = clamp(base + effectiveStep.value)
  emit('update:modelValue', next)
  if (isFocused.value) inputText.value = formatLoose(next)
}

function decrease() {
  const base = props.modelValue > 0 ? props.modelValue : props.min
  const next = clamp(base - effectiveStep.value)
  emit('update:modelValue', next)
  if (isFocused.value) inputText.value = formatLoose(next)
}
</script>

<template>
  <div class="numeric-stepper" :class="[`variant-${variant}`, { compact }]">
    <button type="button" class="step-btn" aria-label="减少" @click="decrease">
      <SdIcon name="minus" :size="14" />
    </button>
    <input
      class="step-input"
      type="text"
      :inputmode="decimals > 0 ? 'decimal' : 'numeric'"
      :pattern="decimals > 0 ? '[0-9]*[.]?[0-9]*' : '[0-9]*'"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="done"
      :value="isFocused ? inputText : formatLoose(modelValue)"
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
    />
    <button type="button" class="step-btn" aria-label="增加" @click="increase">
      <SdIcon name="plus" :size="14" />
    </button>
  </div>
</template>

<style scoped>
.numeric-stepper {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 32px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.step-btn {
  flex-shrink: 0;
  width: 36px;
  border: none;
  background: #f5f7fa;
  color: #606266;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.step-btn:active {
  background: #e4e7ed;
}

.step-input {
  flex: 1;
  min-width: 0;
  border: none;
  border-left: 1px solid #dcdfe6;
  border-right: 1px solid #dcdfe6;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  background: #fff;
  outline: none;
  padding: 0 4px;
  -webkit-appearance: none;
  appearance: none;
  font-variant-numeric: tabular-nums;
}

.variant-pixel.numeric-stepper {
  height: 34px;
  border: 2px solid var(--sd-border, #8b6914);
  border-radius: 0;
  box-shadow: 2px 2px 0 0 var(--sd-shadow, #5c4033);
  background: var(--sd-surface, #fff8ee);
}

.variant-pixel .step-btn {
  width: 32px;
  background: var(--sd-bg-alt, #e8d4a8);
  color: var(--sd-text, #3e2723);
  font-family: 'Fusion Pixel Zh_hans', monospace, sans-serif;
}

.variant-pixel .step-btn:active {
  background: var(--sd-surface-wood, #d4bc96);
}

.variant-pixel .step-input {
  border-color: var(--sd-border-light, #c4a882);
  background: var(--sd-surface, #fff8ee);
  color: var(--sd-text, #3e2723);
  font-family: 'Fusion Pixel Zh_hans', 'Cabin', sans-serif;
  font-size: 16px;
}

.numeric-stepper.compact {
  height: 30px;
}

.numeric-stepper.compact .step-btn {
  width: 24px;
  font-size: 16px;
}

.numeric-stepper.compact .step-input {
  font-size: 16px;
  padding: 0 2px;
}

.variant-pixel.compact {
  height: 32px;
}

.variant-pixel.compact .step-btn {
  width: 22px;
  font-size: 14px;
}

.variant-pixel.compact .step-input {
  font-size: 16px;
}
</style>
