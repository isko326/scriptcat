import { SandboxContext, ScriptContext } from "@App/apps/grant/frontend";
import { ScriptCache, Script } from "@App/model/do/script";

export function compileScriptCode(script: ScriptCache): string {
    let code = script.code;
    script.metadata['require']?.forEach((val) => {
        let res = script.resource![val];
        if (res) {
            code = res.content + "\n" + code;
        }
    });
    return 'with (context) return (()=>{\n' + code + '\n})()'
}

export function compileScript(script: ScriptCache): Function {
    return new Function('context', script.code);
}


export function buildWindow(): any {
    return {
        localStorage: window.localStorage,
    }
}

let special: any = {
    "addEventListener": window.addEventListener,
    "removeEventListener": window.removeEventListener,
    "dispatchEvent": window.dispatchEvent,
};

// 复制原有的,防止被前端网页复写
let descs = Object.getOwnPropertyDescriptors(window);
for (const key in descs) {
    let desc = descs[key];
    if (desc && desc.writable && !special[key]) {
        special[key] = desc.value;
    }
}

// 处理有多层结构的(先只对特殊的做处理)
['console'].forEach(obj => {
    let descs = Object.getOwnPropertyDescriptors((<any>window)[obj]);
    special[obj] = {};// 清零
    for (const key in descs) {
        let desc = descs[key];
        if (desc && desc.writable) {
            special[obj][key] = desc.value;
        }
    }
});

//TODO:做一些恶意操作拦截等
export function buildThis(global: any, context: any) {
    let proxy: any = new Proxy(context, {
        defineProperty(_, name, desc) {
            return Object.defineProperty(context, name, desc);
        },
        get(_, name) {
            switch (name) {
                case 'window':
                case 'global':
                case 'globalThis':
                    return proxy;
            }
            if (name !== 'undefined' && name !== Symbol.unscopables) {
                if (context[name]) {
                    return context[name];
                }
                if (special[name]) {
                    if (typeof special[name] === 'function' && !special[name].prototype) {
                        return special[name].bind(global);
                    }
                    return special[name];
                }
                if (global[name]) {
                    if (typeof global[name] === 'function' && !global[name].prototype) {
                        return global[name].bind(global);
                    }
                    return global[name];
                }
            }
            return undefined;
        },
        has(_, name) {
            return name == 'undefined' || context[name] || global.hasOwnProperty(name);
        },
        getOwnPropertyDescriptor(_, name) {
            let ret = Object.getOwnPropertyDescriptor(context, name)
            if (ret) {
                return ret;
            }
            ret = Object.getOwnPropertyDescriptor(global, name);
            return ret;
        }
    });
    return proxy;
}

function setDepend(context: ScriptContext, apiVal: { [key: string]: any }) {
    if (apiVal?.param.depend) {
        for (let i = 0; i < apiVal?.param.depend.length; i++) {
            let value = apiVal.param.depend[i];
            let dependApi = context.getApi(value);
            if (!dependApi) {
                return;
            }
            if (value.startsWith("GM.")) {
                let [_, t] = value.split(".");
                context["GM"][t] = dependApi?.api;
            } else {
                context[value] = dependApi?.api;
            }
            setDepend(context, dependApi);
        }
    }
}

export function createSandboxContext(script: ScriptCache): SandboxContext {
    let context: SandboxContext = new SandboxContext(script);
    return <SandboxContext>createContext(context, script);
}

export function createContext(context: ScriptContext, script: Script): ScriptContext {
    if (script.metadata["grant"]) {
        context["GM"] = context;
        script.metadata["grant"].forEach((value: any) => {
            let apiVal = context.getApi(value);
            if (!apiVal) {
                return;
            }
            if (value.startsWith("GM.")) {
                let [_, t] = value.split(".");
                context["GM"][t] = apiVal?.api;
            } else {
                context[value] = apiVal?.api;
            }
            setDepend(context, apiVal);
        });
    }
    context['GM_info'] = context.GM_info();

    // 去除原型链
    return Object.assign({}, context);
}
