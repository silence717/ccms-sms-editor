/**
 * Created by AshZhang on 2016/1/18.
 */

import './_sms-editor.scss';
import SMSEditorCtrl from './SMSEditorCtrl';
// import template from './sms-editor.tpl.html';
const template = require('./sms-editor.tpl.html')

export default {

	bindToController: true,
	controller: SMSEditorCtrl,
	controllerAs: 'ctrl',
	replace: true,
	restrict: 'E',
	scope: {
		opts: '='
	},
	template
};
