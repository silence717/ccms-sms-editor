import angular from 'angular';

import smsEditor from './components/sms-editor';
import smsPreview from './components/sms-preview';

export default angular
	.module('ccms.components.sms', [
		smsEditor,
		smsPreview
	])
	.name;

