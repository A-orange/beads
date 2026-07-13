<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 图纸卡片用稍小装饰 */
    sheet?: boolean
    /** 是否预留底部抽奖/色卡区高度（浮动装饰避开底部） */
    lotteryOffset?: boolean
  }>(),
  {
    sheet: false,
    lotteryOffset: true,
  },
)
</script>

<template>
  <div
    class="island-decor"
    :class="{ 'island-decor--sheet': sheet, 'island-decor--lottery': lotteryOffset }"
    aria-hidden="true"
  >
    <!-- 四角叶子 -->
    <svg
      v-for="corner in ['tl', 'tr', 'bl', 'br']"
      :key="corner"
      class="island-decor__leaf"
      :class="`island-decor__leaf--${corner}`"
      viewBox="0 0 64 64"
      width="56"
      height="56"
    >
      <path
        d="M8 56 C 8 24, 32 4, 60 6 C 58 36, 38 58, 8 56 Z"
        fill="#8ac68a"
        stroke="#3d5a1a"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <path
        d="M14 50 C 26 40, 40 26, 56 12"
        stroke="#3d5a1a"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M22 42 C 28 38, 32 34, 36 30"
        stroke="#3d5a1a"
        stroke-width="1.4"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M30 48 C 34 44, 38 40, 42 36"
        stroke="#3d5a1a"
        stroke-width="1.4"
        fill="none"
        stroke-linecap="round"
      />
    </svg>

    <!-- 小花 ×3 -->
    <span
      v-for="(flower, idx) in [
        { cls: 'f1', size: 28, fill: '#f8a6b2' },
        { cls: 'f2', size: 22, fill: '#ecdf52' },
        { cls: 'f3', size: 20, fill: '#b77dee' },
      ]"
      :key="flower.cls"
      class="island-decor__float"
      :class="`island-decor__float--${flower.cls}`"
      :style="{ animationDelay: `${idx * 0.6}s` }"
    >
      <svg :viewBox="'0 0 32 32'" :width="flower.size" :height="flower.size">
        <ellipse
          v-for="rot in [0, 72, 144, 216, 288]"
          :key="rot"
          cx="16"
          cy="8"
          rx="5"
          ry="7"
          :fill="flower.fill"
          stroke="#725d42"
          stroke-width="1.2"
          :transform="`rotate(${rot} 16 16)`"
        />
        <circle cx="16" cy="16" r="3.5" fill="#f7cd67" stroke="#725d42" stroke-width="1.2" />
      </svg>
    </span>

    <!-- 星星 ×2 -->
    <span
      class="island-decor__float island-decor__float--s1"
      style="animation-delay: 0.3s"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
          fill="#f7cd67"
          stroke="#725d42"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span
      class="island-decor__float island-decor__float--s2"
      style="animation-delay: 1s"
    >
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path
          d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
          fill="#82d5bb"
          stroke="#725d42"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.island-decor {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
}

/* 图纸预览：装饰沉底，避免挡住网格 */
.island-decor--sheet {
  z-index: 0;
}

.island-decor__leaf {
  position: absolute;
  width: 56px;
  height: 56px;
  filter: drop-shadow(0 2px 3px rgba(61, 52, 40, 0.15));
}

.island-decor__leaf--tl {
  top: -8px;
  left: -8px;
  transform: rotate(-25deg);
}

.island-decor__leaf--tr {
  top: -8px;
  right: -8px;
  transform: rotate(115deg) scaleX(-1);
}

.island-decor__leaf--bl {
  bottom: -8px;
  left: -8px;
  transform: rotate(-115deg);
}

.island-decor__leaf--br {
  bottom: -8px;
  right: -8px;
  transform: rotate(25deg) scaleX(-1);
}

.island-decor--sheet .island-decor__leaf {
  width: 44px;
  height: 44px;
}

.island-decor--sheet .island-decor__leaf--tl,
.island-decor--sheet .island-decor__leaf--tr {
  top: -6px;
}

.island-decor--sheet .island-decor__leaf--bl,
.island-decor--sheet .island-decor__leaf--br {
  bottom: -6px;
}

.island-decor__float {
  position: absolute;
  display: block;
  line-height: 0;
  animation: island-decor-float 4.5s ease-in-out infinite;
  filter: drop-shadow(0 2px 3px rgba(61, 52, 40, 0.12));
}

.island-decor__float--f1 {
  top: 60px;
  right: 38px;
}

.island-decor__float--f2 {
  top: 130px;
  left: 30px;
}

.island-decor__float--f3 {
  bottom: 24px;
  right: 26px;
}

.island-decor--lottery .island-decor__float--f3 {
  bottom: calc(var(--lottery-h, 160px) + 24px);
}

.island-decor__float--s1 {
  top: 100px;
  right: 80px;
}

.island-decor__float--s2 {
  bottom: 4px;
  left: 60px;
}

.island-decor--lottery .island-decor__float--s2 {
  bottom: calc(var(--lottery-h, 160px) - 4px);
}

.island-decor--sheet .island-decor__float--f1 {
  top: 18px;
  right: 56px;
}

.island-decor--sheet .island-decor__float--f2 {
  top: 22px;
  left: 52px;
}

.island-decor--sheet .island-decor__float--f3 {
  bottom: calc(var(--lottery-h, 160px) + 8px);
  right: 18px;
}

.island-decor--sheet .island-decor__float--s1 {
  top: 36px;
  right: 96px;
}

.island-decor--sheet .island-decor__float--s2 {
  bottom: calc(var(--lottery-h, 160px) + 12px);
  left: 22px;
}

@keyframes island-decor-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-6px) rotate(8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .island-decor__float {
    animation: none;
  }
}
</style>
