import Router from '@koa/router'
import * as ctrl from '../controllers/cyber-defense'

export const cyberDefenseRoutes = new Router()

cyberDefenseRoutes.post('/api/cyber-defense/wechat/report', ctrl.sendWechatReport)
