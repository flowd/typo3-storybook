<?php

declare(strict_types=1);

namespace Andersundsehr\Storybook\Factory;

use TYPO3Fluid\Fluid\Core\ViewHelper\ArgumentDefinition;
use Andersundsehr\Storybook\Dto\ComponentData;
use Andersundsehr\Storybook\Dto\RenderJob;
use Andersundsehr\Storybook\Service\ArgTypesService;
use Andersundsehr\Storybook\Service\ConfigService;
use Andersundsehr\Storybook\Transformer\Transformers;
use Closure;
use DateTime;
use DateTimeImmutable;
use DateTimeInterface;
use Exception;
use RuntimeException;
use TYPO3Fluid\Fluid\Core\Component\ComponentDefinition;
use TYPO3Fluid\Fluid\Core\Rendering\RenderingContextInterface;

use function array_filter;
use function array_keys;
use function enum_exists;
use function gettype;
use function in_array;
use function is_array;
use function is_scalar;

final readonly class ComponentDataFactory
{
    public const string SLOT_PREFIX = 'slot____';

    public function __construct(private ConfigService $configService)
    {
    }

    public function transform(
        ComponentDefinition $componentDefinition,
        Transformers $transformers,
        RenderJob $renderJob,
        RenderingContextInterface $renderingContext,
    ): ComponentData {
        $argumentDefinitions = $componentDefinition->getArgumentDefinitions();

        $args = [];
        /** @var array<string, Closure():string> $slots */
        $slots = [];
        foreach ($renderJob->rawArgs as $key => $value) {
            if (str_starts_with((string)$key, self::SLOT_PREFIX)) {
                $slotName = substr((string)$key, strlen(self::SLOT_PREFIX));
                if (!is_scalar($value) && $value !== null) {
                    throw new RuntimeException(
                        'The slot "' . $slotName . '" must be a string, got ' . gettype($value) . '. Slots take text or Fluid, only arguments take arrays.',
                        3177405166
                    );
                }

                $slots[$slotName] = $this->createSlot($slotName, (string)$value, $renderingContext);
                continue;
            }

            $keyParts = explode('__', $key, 2);
            if (count($keyParts) === 1) {
                $targetType = $argumentDefinitions[$keyParts[0]]->getType();
                $args[$keyParts[0]] = $this->convertToTargetType($targetType, $value);
                continue;
            }

            $transformerDefinitions = $transformers->arguments[$keyParts[0]] ?? throw new RuntimeException(
                'Outdated stories file? The argument transformer for "' . $keyParts[0] . '" is not defined. Please add it to the component definition or remove it from the stories file.',
                4628123687
            );
            $transformerArgumentDefinition = $transformerDefinitions->arguments[$keyParts[1]] ?? throw new RuntimeException(
                'Outdated stories file? The argument transformer for "' . $keyParts[0] . '" does not have a definition for "' . $keyParts[1] . '". Please add it to the component definition or remove it from the stories file.',
                2249880039
            );
            $targetType = $transformerArgumentDefinition->getType();
            $args[$keyParts[0]][$keyParts[1]] = $this->convertToTargetType($targetType, $value);
        }

        foreach ($transformers->arguments as $argumentName => $argumentTransformer) {
            $argumentValues = $args[$argumentName] ?? null;
            $requiredArgumentCount = count(array_filter($argumentTransformer->arguments, static fn(ArgumentDefinition $arg): bool => $arg->isRequired()));
            if ($argumentValues === null && $requiredArgumentCount === 0) {
                $argumentValues = [];
            }

            if (!is_array($argumentValues)) {
                if (!$argumentDefinitions[$argumentName]->isRequired()) {
                    continue;
                }

                throw new RuntimeException(
                    'Outdated stories file? The argument "' . $argumentName . '" is required but not present in the render job. Please update the stories file.',
                    4134567890
                );
            }


            $args[$argumentName] = $argumentTransformer->execute($argumentValues);
        }

        $this->validateResult($componentDefinition, $args, $slots);
        return new ComponentData($args, $slots);
    }


    /**
     * @return Closure(): string
     */
    private function createSlot(string $slotName, string $content, RenderingContextInterface $renderingContext): Closure
    {
        if (!$this->configService->renderSlotsAsFluid()) {
            return static fn(): string => $content;
        }

        // The slot content is a Fluid template in the scope of the story, like the children of a component tag:
        // other components via their global namespace, nested slots, f:fragment and inline arrays work as usual.
        return static function () use ($slotName, $content, $renderingContext): string {
            try {
                $parsedTemplate = $renderingContext->getTemplateParser()->getOrParseAndStoreTemplate(
                    'storybook_slot_' . sha1($content),
                    static fn(): string => $content,
                );

                return (string)$parsedTemplate->render($renderingContext);
            } catch (Exception $exception) {
                throw new RuntimeException(
                    'Could not render the Fluid content of slot "' . $slotName . '": ' . $exception->getMessage(),
                    4382910475,
                    $exception
                );
            }
        };
    }

    private function convertToTargetType(string $targetType, mixed $value): mixed
    {
        if (in_array($targetType, [DateTimeInterface::class, DateTimeImmutable::class], true)) {
            return new DateTimeImmutable($value);
        }

        if ($targetType === DateTime::class) {
            return new DateTime($value);
        }

        if (enum_exists($targetType)) {
            if (!is_string($value)) {
                throw new RuntimeException(
                    'The value for an enum must be a string. The value "' . $value . '" is not a valid enum value.',
                    5151228270
                );
            }

            foreach ($targetType::cases() as $case) {
                if (ArgTypesService::getCaseValue($case) === $value) {
                    return $case;
                }
            }

            throw new RuntimeException(
                'The value "' . $value . '" is not a valid value for the enum "' . $targetType . '".',
                4820654599
            );
        }

        // arrays (the object control) and the other types stay as they are: Fluid converts some and rejects the rest
        return $value;
    }

    /**
     * @param array<string, mixed> $args
     * @param array<string, Closure():string> $slots
     */
    private function validateResult(ComponentDefinition $componentDefinition, array $args, array $slots): void
    {
        $argumentDefinitions = $componentDefinition->getArgumentDefinitions();
        foreach (array_keys($args) as $argumentName) {
            if (!isset($argumentDefinitions[$argumentName])) {
                throw new RuntimeException(
                    'Outdated stories file? The argument "' . $argumentName . '" is not present in the component. Remove it from the stories file or add it to the component.',
                    3931702316
                );
            }
        }

        $availableSlots = array_flip($componentDefinition->getAvailableSlots());
        foreach (array_keys($slots) as $slotName) {
            if (!isset($availableSlots[$slotName])) {
                throw new RuntimeException(
                    'Outdated stories file? The slot "' . $slotName . '" is not present in the component. Remove it from the stories file or add it to the component.',
                    3399576233
                );
            }
        }
    }
}
