/**
 * Created by wujingtao on 2016/8/24 0024.
 */

/*数据分发中心*/

/**
 *代表所对应路径的每一个分发层级
 */
class DispatchLevel {
    /**
     * @param {string} levelName 当前层级的名字
     */
    constructor(levelName = '') {
        this.levelName = levelName; //当前层级的名字
        this.receiver = new Set();  //当前层级的接收器
        this.children = new Map();  //子层级
    }
}

/**
 * 转换路径字符串的类型
 * @param {string|Array} path
 */
function convertPathType(path) {
    if(typeof path === 'string')    //验证path的数据类型
        path = path.split('.');
    else if(!Array.isArray(path))
        throw new Error('path must be a string or array');
    
    return path;
}

const dispatchList = new DispatchLevel('root');

/**
 * 注册数据接收器
 * @param {string|Array} path 接收哪一条路径上的数据.可以为字符串或数组(字符串通过‘.’来分割层级)
 * @param {function} receiver 接收到数据后执行的回调函数 ,回调函数接受两个参数（data:数据，path:路径字符串数组）
 * @return {function} 返回 receiver
 */
function receive(path, receiver) {
    
    path = convertPathType(path);

    if (typeof receiver !== 'function')  /*验证数据类型*/
        throw new Error('receiver is not a function');

    let level = dispatchList.children;

    path.forEach((item, index) => {  //循环每一级,找到对应的层级

        if (!level.has(item)) {
            level.set(item, new DispatchLevel(item));
        }

        const currentLevel = level.get(item);

        if (index === path.length - 1)
            currentLevel.receiver.add(receiver);

        level = currentLevel.children;
    });

    return receiver;
}

/**
 * 注销数据接收器
 * @param {string|Array} path 注销哪一条路径，以及它的子级.可以为字符串或数组(字符串通过‘.’来分割层级)
 * @return {undefined}
 */
function cancel(path) {

    path = convertPathType(path);

    let level = dispatchList.children;

    path.some((item, index) => {
        const currentLevel = level.get(item);

        if (currentLevel == null) return true;  //跳出循环

        if (index === path.length - 1) {
            currentLevel.receiver.clear();
            currentLevel.children.clear();
        }

        level = currentLevel.children;
    });
}

//辅助方法，用于获取子级所有的接收器方法
function getAllChildrenReceiver(targetLevel) {
    const receiver = [...targetLevel.receiver];

    for (let item of targetLevel.children.values()) {
        receiver.push(...getAllChildrenReceiver(item));
    }

    return receiver;
}

/**
 * 向指定路径发送消息
 * @param {string|Array} path 向哪一条路径发送数据.可以为字符串或数组(字符串通过‘.’来分割层级)
 * @param data 要发送的数据
 * @return {undefined}
 */
function send(path, data) {
    //验证数据类型以及分割字符串放在下面在

    let level = dispatchList.children;

    const pathLevel = path;

    let targetLevel = null;

    pathLevel.some((item, index) => { //循环每一个层级

        const currentLevel = level.get(item);   //获取当前层级

        if (currentLevel == null) return true;  //跳出循环

        if (index === pathLevel.length - 1)
            targetLevel = currentLevel; //获取目标层级

        level = currentLevel.children;
    });

    if (targetLevel) {
        const receiver = getAllChildrenReceiver(targetLevel);
        receiver.forEach(item => item(data, path));
    }
}

module.exports = {
    receive, cancel, dispatchList,

    /**
     * send的包装方法
     * @param path
     * @param data
     * @param needSendToCache   是否需要将这个数据发送给Cache（这个一般只在内部使用）
     */
    send(path, data, needSendToCache = true){

        path = convertPathType(path);

        send(path, data);
        if (needSendToCache)
            send(['__cache__receive',...path], data);  //給缓存再发一份
    }
};

