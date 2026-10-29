<?php

declare(strict_types=1);

namespace Andersundsehr\Storybook\Tests\Unit\Service;

use Andersundsehr\Storybook\Service\ArgTypesService;
use Andersundsehr\Storybook\Service\ConfigService;
use Andersundsehr\Storybook\Transformer\Transformers;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use stdClass;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;
use TYPO3Fluid\Fluid\Core\Component\ComponentDefinition;
use TYPO3Fluid\Fluid\Core\ViewHelper\ArgumentDefinition;

final class ArgTypesServiceTest extends UnitTestCase
{
    #[DataProvider('arrayTypesDataProvider')]
    public function testArrayArgumentsGetTheObjectControl(string $type): void
    {
        $argTypes = $this->getArgTypes(new ArgumentDefinition('items', $type, 'The items', true));

        self::assertSame('object', $argTypes['items']['control']['type']);
        self::assertSame(['name' => $type, 'required' => true], $argTypes['items']['type']);
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function arrayTypesDataProvider(): array
    {
        return [
            'array' => ['array'],
            'typed list' => ['string[]'],
            'list of objects' => [stdClass::class . '[]'],
        ];
    }

    public function testArrayDefaultValueIsSummarizedAsJson(): void
    {
        $argTypes = $this->getArgTypes(new ArgumentDefinition('items', 'array', 'The items', false, ['a' => 1]));

        self::assertSame('{"a":1}', $argTypes['items']['table']['defaultValue']['summary']);
    }

    public function testScalarDefaultValueStaysAsItIs(): void
    {
        $argTypes = $this->getArgTypes(new ArgumentDefinition('title', 'string', 'The title', false, 'Hello'));

        self::assertSame('Hello', $argTypes['title']['table']['defaultValue']['summary']);
    }

    public function testObjectArgumentsAreRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionCode(2432569368);

        $this->getArgTypes(new ArgumentDefinition('file', stdClass::class, 'A file', true));
    }

    #[DataProvider('isArrayTypeDataProvider')]
    public function testIsArrayType(string $type, bool $expected): void
    {
        self::assertSame($expected, ArgTypesService::isArrayType($type));
    }

    /**
     * @return array<string, array{0: string, 1: bool}>
     */
    public static function isArrayTypeDataProvider(): array
    {
        return [
            'array' => ['array', true],
            'string[]' => ['string[]', true],
            'string' => ['string', false],
            'iterable' => ['iterable', false],
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function getArgTypes(ArgumentDefinition $argumentDefinition): array
    {
        $configService = $this->createStub(ConfigService::class);
        $configService->method('getExcludedArguments')->willReturn([]);

        return (new ArgTypesService($configService))->getArgTypes(
            new ComponentDefinition('storybook:test', [$argumentDefinition->getName() => $argumentDefinition], false, []),
            new Transformers([], 'none'),
        );
    }
}
