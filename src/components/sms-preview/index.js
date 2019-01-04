import angular from 'angular';
import ngSanitize from 'angular-sanitize';
import ddofn from './SMSPreview';


export default angular
	.module('ccms.components.sms.SMSPreview', [ngSanitize])
	.directive('ccmsSmsPreview', ['$sce', ddofn])
	.name;
