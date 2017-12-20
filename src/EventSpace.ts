/**
 * 事件监听器
 */
export interface Listener<T> {
    /**
     * @param data 传递的数据
     * @param layer 监听器所在层的引用
     */
    (data: any, layer: EventSpace<T>): any;
}

/**
 * 添加或删除事件监听器回调
 */
export interface AddOrRemoveListenerCallback<T> {
    /**
     * @param listener 发生变化的监听器
     * @param layer 发生变化的层
     */
    (listener: Listener<T>, layer: EventSpace<T>): any;
}

/**
 * 事件名称
 */
export type EventName = string | string[];

/**
 * 将事件名转换成数组的形式
 * @param eventName 事件名称
 */
export function convertEventNameType(eventName: EventName) {
    if (Array.isArray(eventName))
        return eventName;
    else if (eventName === '')
        return [];
    else
        return eventName.split('.');
}

export default class EventSpace<T> {

    //#region 属性与构造

    /**
     * 当前层注册的事件监听器     
     */
    private readonly _listeners: Set<Listener<T>> = new Set();

    /**
     * 当当前层有新的事件监听器被添加时触发的回调函数
     */
    private readonly _onAddListenerCallback: Set<AddOrRemoveListenerCallback<T>> = new Set();

    /**
     * 当当前层有事件监听器被删除时触发的回调函数
     */
    private readonly _onRemoveListenerCallback: Set<AddOrRemoveListenerCallback<T>> = new Set();

    /**
     * 相对于当前层，当父层有新的事件监听器被添加时触发的回调函数
     */
    private readonly _onAncestorAddListenerCallback: Set<AddOrRemoveListenerCallback<T>> = new Set();

    /**
     * 相对于当前层，当父层有事件监听器被删除时触发的回调函数
     */
    private readonly _onAncestorRemoveListenerCallback: Set<AddOrRemoveListenerCallback<T>> = new Set();

    /**
     * 相对于当前层，当子层有新的事件监听器被添加时触发的回调函数
     */
    private readonly _onDescendantsAddListenerCallback: Set<AddOrRemoveListenerCallback<T>> = new Set();

    /**
     * 相对于当前层，当子层有事件监听器被删除时触发的回调函数
     */
    private readonly _onDescendantsRemoveListenerCallback: Set<AddOrRemoveListenerCallback<T>> = new Set();

    /**
     * 父层。根的父层为undefined   
     */
    readonly parent?: EventSpace<T>;

    /**
    * 子层, key:子层名称
    */
    readonly children: Map<string, EventSpace<T>> = new Map();

    /**
     * 当前层的名称。根的名称为空字符串    
     * 注意：以数组表示时，空数组才代表根
     */
    readonly name: string;

    /**
     * 供用户保存一些自定义数据。    
     * 注意：当所在层不再有监听器注册时，data中的数据将被清除
     */
    data?: T;

    /**
     * 获取当前层的完整事件名称。（返回从根到当前层，由每一层的name组成的数组）
     */
    get fullName(): string[] {
        if (this.parent) {
            const result = this.parent.fullName
            result.push(this.name);
            return result;
        } else
            return [];
    }

    /**
     * 当前层注册了多少监听器
     */
    get count(): number {
        return this._listeners.size;
    }

    /**
     * 相对于当前层，获取所有父层上注册了多少监听器。(不包括当前层)
     */
    get ancestorListenerCount(): number {
        if (this.parent)
            return this.parent.ancestorListenerCount + this.parent._listeners.size;
        else
            return 0;
    }

    /**
     * 相对于当前层，获取所有子层上注册了多少监听器。(不包括当前层)
     */
    get descendantsListenerCount(): number {
        let result = 0;

        for (const item of this.children.values()) {
            result += item.descendantsListenerCount + item._listeners.size;
        }

        return result;
    }

    constructor(parent?: EventSpace<T>, name: string = '') {
        this.parent = parent;
        this.name = name;
    }

    //#endregion

    //#region 工具方法

    /**
     * 相对于当前层，根据事件名称获取特定的子层，如果不存在就返回空。
     * @param eventName 事件名称
     */
    getChild(eventName: EventName, autoCreateLayer: false): EventSpace<T> | undefined
    /**
     * 相对于当前层，根据事件名称获取特定的子层，如果不存在就自动创建。
     * @param eventName 事件名称
     */
    getChild(eventName: EventName, autoCreateLayer: true): EventSpace<T>
    getChild(eventName: EventName, autoCreateLayer: boolean) {
        let layer: EventSpace<T> = this;

        for (const currentName of convertEventNameType(eventName)) {
            let currentLayer = layer.children.get(currentName);

            if (currentLayer === undefined) {
                if (autoCreateLayer) {
                    currentLayer = new EventSpace<T>(layer, currentName);
                    layer.children.set(currentName, currentLayer);
                } else {
                    return undefined;
                }
            }

            layer = currentLayer;
        }

        return layer;
    }

    /**
     * 相对于当前层，循环遍历每一个子层。返回boolean，用于判断遍历是否中断。     
     * 提示：如果把callback作为判断条件，可以将forEachChildren模拟成includes来使用
     * @param callback 回调。返回true则终止遍历
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    forEachChildren(callback: (layer: EventSpace<T>) => void | boolean, includeCurrentLayer: boolean = false): boolean {
        if (includeCurrentLayer)
            if (callback(this)) return true;

        for (const item of this.children.values()) {
            if (item.forEachChildren(callback, true)) return true;
        }

        return false;
    }

    /**
     * 相对于当前层，循环遍历每一个父层。返回boolean，用于判断遍历是否中断。     
     * 提示：如果把callback作为判断条件，可以将forEachParents模拟成includes来使用
     * @param callback 回调。返回true则终止遍历
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    forEachParents(callback: (layer: EventSpace<T>) => void | boolean, includeCurrentLayer: boolean = false): boolean {
        if (includeCurrentLayer)
            if (callback(this)) return true;

        if (this.parent)
            return this.parent.forEachParents(callback, true);
        else
            return false;
    }

    /**
     * 相对于当前层，将所有子层保存到一个数组中。    
     * 注意：子层的数目随时可能会变化，因为可能会有监听器在新的子层上注册
     * 
     * @param callback undefined
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    mapChildren(callback?: undefined, includeCurrentLayer?: boolean): EventSpace<T>[]
    /**
     * 相对于当前层，遍历每一个子层，将每一次遍历的结果保存到一个数组中。    
     * 注意：子层的数目随时可能会变化，因为可能会有监听器在新的子层上注册
     * 
     * @param callback 回调
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    mapChildren<P>(callback: (layer: EventSpace<T>) => P, includeCurrentLayer?: boolean): P[]
    mapChildren(callback?: Function, includeCurrentLayer?: boolean): any[] {
        const result: any[] = [];

        this.forEachChildren(layer => {
            if (callback)
                result.push(callback(layer));
            else
                result.push(layer);
        }, includeCurrentLayer);

        return result;
    }

    /**
     * 相对于当前层，将所有父层保存到一个数组中
     * @param callback undefined
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    mapParents(callback?: undefined, includeCurrentLayer?: boolean): EventSpace<T>[]
    /**
     * 相对于当前层，遍历每一个父层，将每一次遍历的结果保存到一个数组中。    
     * @param callback 回调
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    mapParents<P>(callback: (layer: EventSpace<T>) => P, includeCurrentLayer?: boolean): P[]
    mapParents(callback?: Function, includeCurrentLayer?: boolean): any[] {
        const result: any[] = [];

        this.forEachParents(layer => {
            if (callback)
                result.push(callback(layer));
            else
                result.push(layer);
        }, includeCurrentLayer);

        return result;
    }

    /**
     * 相对于当前层，累加每一个子层。类似于数组的reduce
     * @param callback 回调
     * @param initial 初始值
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    reduceChildren<P>(callback: (previous: P, layer: EventSpace<T>) => P, initial: P, includeCurrentLayer?: boolean): P {
        let result = initial;

        this.forEachChildren(layer => { result = callback(result, layer) }, includeCurrentLayer);

        return result;
    }

    /**
     * 相对于当前层，累加每一个父层。类似于数组的reduce
     * @param callback 回调
     * @param initial 初始值
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    reduceParents<P>(callback: (previous: P, layer: EventSpace<T>) => P, initial: P, includeCurrentLayer?: boolean): P {
        let result = initial;

        this.forEachParents(layer => { result = callback(result, layer) }, includeCurrentLayer);

        return result;
    }

    /**
     * 相对于当前层，根据给定的条件找出一个特定的子层
     * @param callback 判断条件，如果满足则返回true
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    findChild(callback: (layer: EventSpace<T>) => boolean, includeCurrentLayer?: boolean): EventSpace<T> | undefined {
        let result: EventSpace<T> | undefined;

        this.forEachChildren(layer => {
            if (callback(layer)) {
                result = layer;
                return true;
            }
        }, includeCurrentLayer);

        return result;
    }

    /**
     * 相对于当前层，根据给定的条件找出一个特定的父层
     * @param callback 判断条件，如果满足则返回true
     * @param includeCurrentLayer 是否包含当前层，默认false
     */
    findParent(callback: (layer: EventSpace<T>) => boolean, includeCurrentLayer?: boolean): EventSpace<T> | undefined {
        let result: EventSpace<T> | undefined;

        this.forEachParents(layer => {
            if (callback(layer)) {
                result = layer;
                return true;
            }
        }, includeCurrentLayer);

        return result;
    }

    //#endregion

    
}