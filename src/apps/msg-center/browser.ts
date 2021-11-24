
// 前端用通信

import { randomString } from "@App/pkg/utils/utils";

export type ListenMsg = (msg: any) => void;

// 浏览器页面之间的通信,主要在content和injected页面之间
export class BrowserMsg {

    public id: string;

    public content: boolean;

    public listenMap = new Map<string, ListenMsg>();

    constructor(id: string, content: boolean) {
        this.id = id;
        this.content = content;
        document.addEventListener(this.id + (content ? 'ct' : 'fd'), (event: any) => {
            let detail = event.detail;
            let topic = detail.topic;
            let listen = this.listenMap.get(topic);
            if (listen) {
                listen(detail.msg);
            }
        });
    }

    public send(topic: string, msg: any) {
        let detail = Object.assign({}, {
            topic: topic,
            msg: msg,
        });
        if ((<any>global).cloneInto) {
            try {
                detail = (<any>global).cloneInto(detail, document.defaultView);
            } catch (e) {
                console.log(e);
            }
        }
        let ev = new CustomEvent(this.id + (this.content ? 'fd' : 'ct'), {
            detail: detail,
        });
        document.dispatchEvent(ev);
    }

    public listen(topic: string, callback: ListenMsg) {
        this.listenMap.set(topic, callback);
    }

}