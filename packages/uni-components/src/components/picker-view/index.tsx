import {
  Ref,
  ref,
  watch,
  provide,
  WritableComputedRef,
  computed,
  reactive,
  VNode,
  SetupContext,
  PropType,
  ComponentInternalInstance,
  onMounted,
  ComponentPublicInstance,
  nextTick,
} from 'vue'
import { defineBuiltInComponent } from '../../helpers/component'
import { flatVNode } from '../../helpers/flatVNode'
import { useRebuild } from '../../helpers/useRebuild'
import ResizeSensor from '../resize-sensor/index'
import { useCustomEvent } from '../../helpers/useEvent'

const props = {
  value: {
    type: Array as PropType<number[]>,
    default() {
      return []
    },
    validator: function (val: any) {
      return (
        Array.isArray(val) &&
        val.filter((val) => typeof val === 'number').length === val.length
      )
    },
  },
  indicatorStyle: {
    type: String,
    default: '',
  },
  indicatorClass: {
    type: String,
    default: '',
  },
  maskStyle: {
    type: String,
    default: '',
  },
  maskClass: {
    type: String,
    default: '',
  },
}

export type Props = Record<keyof typeof props, any>
export interface State {
  value: number[]
  height: number
}
function useState(props: Props): State {
  const value: number[] = reactive([...props.value])
  const state = reactive({
    value,
    height: 34,
  })
  watch(
    () => props.value,
    (val: number[], oldVal: number[]) => {
      if (
        __PLATFORM__ !== 'app' ||
        val === oldVal ||
        val.length !== oldVal.length ||
        val.findIndex((item, index) => item !== oldVal[index]) >= 0
      ) {
        state.value.length = val.length
        val.forEach((val, index) => {
          if (val !== state.value[index]) {
            state.value.splice(index, 1, val)
          }
        })
      }
    }
  )
  return state
}

export type GetPickerViewColumn = (
  columnInstance: ComponentInternalInstance
) => WritableComputedRef<number>

export default /*#__PURE__*/ defineBuiltInComponent({
  name: 'PickerView',
  props,
  emits: ['change', 'pickstart', 'pickend', 'update:value'],
  setup(props, { slots, emit }) {
    const rootRef: Ref<HTMLElement | null> = ref(null)
    const wrapperRef: Ref<HTMLElement | null> = ref(null)
    const trigger = useCustomEvent(rootRef, emit as SetupContext['emit'])
    const state = useState(props)
    const resizeSensorRef: Ref<ComponentPublicInstance | null> = ref(null)
    const onMountedCallback = () => {
      const resizeSensor = resizeSensorRef.value as ComponentPublicInstance
      state.height = resizeSensor.$el.offsetHeight
    }
    if (__PLATFORM__ !== 'app') {
      onMounted(onMountedCallback)
    }
    let ColumnsPreRef: Ref<VNode[]> = ref([])
    let columnsRef: Ref<VNode[] | HTMLCollection> = ref([])
    function getItemIndex(vnode: VNode): number {
      const columnVNodes = (columnsRef.value as VNode[]).filter(
        (ref) => typeof ref.type !== 'symbol'
      )
      if (__PLATFORM__ === 'app' && columnVNodes) {
        return Array.prototype.indexOf.call(columnVNodes, vnode.el)
      }
      let index: number = columnVNodes.indexOf(vnode)
      return index !== -1 ? index : ColumnsPreRef.value.indexOf(vnode)
    }
    const getPickerViewColumn: GetPickerViewColumn = function (columnInstance) {
      const ref: WritableComputedRef<number> = computed({
        get() {
          const index = getItemIndex(columnInstance.vnode)
          return state.value[index] || 0
        },
        set(current: number) {
          const index = getItemIndex(columnInstance.vnode)
          if (index < 0) {
            return
          }
          const oldCurrent = state.value[index]
          if (oldCurrent !== current) {
            state.value[index] = current
            // 避免外部直接对此值进行修改
            const value = state.value.map((val) => val)
            emit('update:value', value)
            trigger('change', {} as Event, {
              value,
            })
          }
        },
      })
      return ref
    }
    provide('getPickerViewColumn', getPickerViewColumn)
    provide('pickerViewProps', props)
    provide('pickerViewState', state)

    if (__PLATFORM__ === 'app') {
      useRebuild(() => {
        // 由于 App 端 onMounted 时机未插入真实位置，需重新执行
        onMountedCallback()
        columnsRef.value = (wrapperRef.value as HTMLElement).children
      })
    }

    return () => {
      const defaultSlots = slots.default && slots.default()
      if (__PLATFORM__ !== 'app') {
        // TODO filter
        const vnode = flatVNode(defaultSlots)
        ColumnsPreRef.value = vnode
        nextTick(() => {
          columnsRef.value = vnode
        })
      }
      return (
        <uni-picker-view ref={rootRef}>
          <ResizeSensor
            ref={resizeSensorRef}
            // @ts-ignore
            onResize={({ height }: { height: number }) =>
              (state.height = height)
            }
          ></ResizeSensor>
          <div ref={wrapperRef} class="uni-picker-view-wrapper">
            {defaultSlots}
          </div>
        </uni-picker-view>
      )
    }
  },
})