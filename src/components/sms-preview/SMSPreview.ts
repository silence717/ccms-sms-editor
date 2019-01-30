/**
 * Created by AshZhang on 16/1/29.
 */

import './_sms-preview.scss';
import * as angular from 'angular';
import { opts } from '../../../typings/sms';
const template = require('./sms-preview.tpl.html')
// import template from './sms-preview.tpl.html';

const escapeRegExp = (str: string) => {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

export default ($sce: ng.ISCEDelegateService) => ({

	restrict: 'E',
	scope: {
		opts: '='
	},
	template,

	link(scope: ng.IScope, element: ng.IRootElementService) {

		const opts: opts = scope.opts || (scope.opts = {});
		const keywordPrefix: string = scope.opts.keywordPrefix || 'œœ';
		const keywordSuffix: string = scope.opts.keywordSuffix || 'œœ';
		const trimContent: boolean = angular.isDefined(opts.trimContent) ? opts.trimContent : true;
		scope.smsPreviewStatText = trimContent ? '不含变量' : '含空格，不含变量';
		scope.smsPreviewTipsText = trimContent ? '2.上图仅为操作预览，最终字数和计费条数以实际执行时发送为准。' : '2.上图仅为操作预览，变量无固定长度，最终字数和计费条数以实际执行时发送为准，建议先测试执行。';

		scope.$watch('opts', () => {
			const varReg = RegExp(`${escapeRegExp(keywordPrefix)}_(\\[[^]]+])?(.+?)_${escapeRegExp(keywordSuffix)}`, 'g');

			const gatewayType = opts.gatewayType;
			const text = opts.text || '';
			const preview = opts.preview || '';
			const signature = opts.signature || '';
			const customSignature = opts.customSignature ? `【${opts.customSignature.replace(/</g, '&lt;')}】` : '';
			const unsubscribeText = opts.useUnsubscribe ? (opts.unsubscribeText || '') : '';

			// @ts-ignore $sce 上没有定义 trustAsHtml 方法
			scope.smsPreviewTipsInTipsText = $sce.trustAsHtml(opts.smsChargeTips ? `1.${opts.smsChargeTips}` : '1.当前通道单条短信字数限制 <span style="color: red;">70</span> 个字；超出 70 个字，按 <span style="color: red;">67</span> 字一条计费；');
			// 字数统计
			scope.totalChars = opts.totalCharts = text
				.replace(varReg, '')
				.replace(/þ_enter_þ/g, '').length +
				(gatewayType === 1 || gatewayType === 3 || gatewayType === 4 || gatewayType === 5 ? signature.length : 0) +
				customSignature.length +
				unsubscribeText.length;
			// 换行统计
			scope.newLineNum = opts.newLineNum = text.split('þ_enter_þ').length - 1;

			// 变量统计
			const varMatch = text.match(varReg);
			scope.totalVars = opts.totalVars = varMatch ? varMatch.length : 0;

			element[0].querySelector('.sms-preview-content').innerHTML = opts.generatedText = this.generateText(preview, unsubscribeText, signature, customSignature, gatewayType);
		}, true);
	},

	/*
	 0: 短信 +【自定义签名】
	 1,5: 短信 +【自定义签名】+ 备案签名
	 2: 【自定义签名】+ 短信
	 3,4: 备案签名 +【自定义签名】+ 短信
	 */
	generateText(preview: string, unsubscribeText: string, signature: string, customSignature: string, gatewayType: number) {
		const content = preview.split('þ_enter_þ');
		const len = content.length;

		switch (gatewayType) {
			case 0:
				content[len - 1] = content[len - 1] + unsubscribeText + customSignature;
				return this.formatEmpty(content);
			case 1:
			case 5:
				content[len - 1] = content[len - 1] + unsubscribeText + customSignature + signature;
				return this.formatEmpty(content);
			case 2:
				content[0] = customSignature + content[0];
				content[len - 1] = content[len - 1] + unsubscribeText;
				return this.formatEmpty(content);
			case 3:
			case 4:
				content[0] = signature + customSignature + content[0];
				content[len - 1] = content[len - 1] + unsubscribeText;
				return this.formatEmpty(content);
		}

		return '';
	},

	/**
	 * 将空行标记格式化
	 * */
	formatEmpty(data: string[]) {
		const sms: string[] = [];
		for (let item of data) {
			const content: string = item.length ? `<div>${item}</div>` : '<div><br/></div>';
			sms.push(content);
		}
		return sms.join('');
	}
});
