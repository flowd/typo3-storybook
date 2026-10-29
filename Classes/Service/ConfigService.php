<?php

declare(strict_types=1);

namespace Andersundsehr\Storybook\Service;

use TYPO3\CMS\Core\Configuration\Exception\ExtensionConfigurationExtensionNotConfiguredException;
use TYPO3\CMS\Core\Configuration\Exception\ExtensionConfigurationPathDoesNotExistException;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\Utility\GeneralUtility;

class ConfigService
{
    public function __construct(
        private readonly ExtensionConfiguration $extensionConfiguration
    ) {
    }

    /**
     * @return string[]
     */
    public function getExcludedArguments(): array
    {
        $excludeString = $this->extensionConfiguration->get('storybook', 'excludeArguments');
        if ($excludeString === '') {
            return [];
        }

        return GeneralUtility::trimExplode(',', $excludeString);
    }

    /**
     * Whether slot values of a story are rendered as Fluid templates (nested components, named slots via
     * f:fragment) instead of being passed through as sanitized plain strings. Off by default, as it lets
     * story authors run arbitrary Fluid in the TYPO3 instance.
     */
    public function renderSlotsAsFluid(): bool
    {
        try {
            return (bool)$this->extensionConfiguration->get('storybook', 'renderSlotsAsFluid');
        } catch (ExtensionConfigurationExtensionNotConfiguredException | ExtensionConfigurationPathDoesNotExistException) {
            return false;
        }
    }
}
